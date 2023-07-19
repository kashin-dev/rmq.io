// const url = 'amqp://localhost'
const url =
  'amqps://sxdwecyw:ieW-YRP8AoBCnwX0NHFSvNgYSx1ou5Yy@possum.lmq.cloudamqp.com/sxdwecyw'

const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  binarySerialization: true
})

rmq.addHook('publish', (msg, topic) => {
  console.log('hook', msg)
  console.log('topic', topic)
})

rmq
  .setRoute('test')
  .start()
  .then(async () => {
    for (let i = 0; i < 2; i++) {
      const resAcka = await rmq.publish(
        {
          content: {
            hello: `a-${i}`
          }
        },
        'a'
      )
      const resAckb = await rmq.publish(
        {
          content: {
            hello: `b-${i}`
          }
        },
        'b'
      )
      const resAckc = await rmq.publish(
        {
          content: {
            hello: `c-${i}`
          }
        },
        'c'
      )

      console.log(resAcka)
      console.log(resAckb)
      console.log(resAckc)
    }
    const resNack = await rmq.publish(
      {
        content: {
          hello: 'world'
        }
      },
      'ack'
    )
    console.log(resNack)
  })

process.on('SIGINT', () => {
  rmq.closeConn(function () {
    process.exit(1)
  })
})
