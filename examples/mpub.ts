import { rmqio } from '../dist'

const url = 'amqp://localhost'
const rmq = rmqio({
  url,
  binarySerialization: true
})

type json = {
  [key: string]: unknown
}
type Message<T> = {
  content: T
  topic?: string
}
type Publish = {
  message: Message<string | json | number>
  topic: string
}

rmq.addHook<Publish>('publish', async ({ message, topic }) => {
  console.log('inicia')
  console.log(message)
  console.log(topic)

  const res = await new Promise((resolve, reject) => {
    setTimeout(function () {
      resolve('¡Éxito!')
    }, 500)
  })

  console.log(res)
})

rmq
  .setRoute('test')
  .start()
  .then(async () => {
    for (let i = 0; i < 1; i++) {
      const resAck = await rmq.publish(
        {
          content: {
            hello: 'ack'
          }
        },
        'Default'
      )
      console.log(resAck)
    }
    const resNack = await rmq.publish({
      content: {
        hello: 'nack'
      }
    })
    console.log(resNack)
  })

process.on('SIGINT', () => {
  rmq.closeConn(function () {
    process.exit(1)
  })
})
