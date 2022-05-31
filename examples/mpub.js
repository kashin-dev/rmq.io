const url = 'amqp://localhost'
const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  binarySerialization: true
})

rmq.addHook('publish', (msg,topic) => {
  console.log('hook', msg)
  console.log('topic', topic)
})

rmq
  .setRoute('test')
  .start()
  .then(async () => {
    for (let i = 0; i < 1; i++) {
      const resAck = await rmq.publish(
        {
          content: {
            hello: `ack-${i}`
          },
        }
      )
      console.log(resAck)
    }
    const resNack = await rmq.publish(
      {
        content: {
          hello: 'nack'
        }
      },
      'nack'
    )
    console.log(resNack)
  })

process.on('SIGINT', () => {
  rmq.closeConn(function () {
    process.exit(1)
  })
})
