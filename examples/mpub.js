const url = 'amqp://guest:guest@localhost:5672'
const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  binarySerialization: true
})

const runTest = args => {
  console.log('This is a test')
}

rmq
  .setRoute('test')
  .start()
  .then(async () => {
    for (let i = 0; i < 1; i++) {
      const resAck = await rmq.publish(
        {
          content: {
            hello: `ack-${i}`
          }
        },
        'ack',
        runTest
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
