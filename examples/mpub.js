const url = 'amqp://localhost'
const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  binarySerialization: true
})

rmq
  .setRoute('test')
  .start()
  .then(async () => {
    for (let i = 0; i < 1; i++) {
      rmq.on('runCallback', args => {
        console.log('The callback was called using the argument: ', args)
      })
      const resAck = await rmq.publish(
        {
          content: {
            hello: `ack-${i}`
          }
        },
        'ack'
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
