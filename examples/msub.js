const url = 'amqp://localhost'

let {rmqio} = require('../dist')

rmqio = rmqio({
  url: url,
  preFetchingPolicy: 50
})

rmqio.on('test', function (msg, ack, nack) {
  console.log(msg)
  ack()
})

rmqio
  .setServiceName('tester')
  .setRoute('test')
  .start()
  .then(() => {
    console.log("connected")
  })

process.on('SIGINT', () => {
  rmqio.closeConn(function () {
    process.exit(1)
  })
})
