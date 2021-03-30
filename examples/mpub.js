const url = 'amqps://localhost'
let {rmqio} = require('../dist')

rmqio = rmqio({url})

rmqio
  .setRoute('test')
  .start()
  .then(async () => {
    const resAck = await rmqio.publish({
      content: {
        hello: 'ack'
      }
    }, 'ack')
    console.log(resAck)
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
