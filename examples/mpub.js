const url = 'amqp://localhost'
let {rmqio} = require('../dist')

rmqio = rmqio({
  url,
  binarySerialization: true
})

rmqio
  .setRoute('test')
  .start()
  .then(async () => {
    for (let i = 0; i < 1; i++) {
      const resAck = await rmqio.publish({
        content: {
          hello: `ack-${i}`
        }
      }, 'ack')
      console.log(resAck)
    }
    const resNack = await rmqio.publish({
      content: {
        hello: 'nack'
      }
    }, 'nack')
    console.log(resNack)
  })

process.on('SIGINT', () => {
  rmqio.closeConn(function () {
    process.exit(1)
  })
})
