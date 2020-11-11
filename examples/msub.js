const url = 'amqp://localhost'

let {rmqio} = require('../dist')

rmqio = rmqio({
  url: url,
  preFetchingPolicy: 50
})

rmqio.on('connection', function (socket) {
  console.log('connected')
})

rmqio.on('test', function (msg, ack, nack) {
  console.log(msg)
  ack()
})

rmqio
  .setServiceName('tester')
  .setRoute('test')
  .subscribe('test')
  .start()

process.on('SIGINT', () => {
  rmqio.closeConn(function () {
    process.exit(1)
  })
})
