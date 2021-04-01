const url = 'amqps://localhost'

let {rmqio} = require('../dist')

rmqio = rmqio({
  url: url,
  preFetchingPolicy: 50,
  log: true,
  //quorumQueuesEnabled: true
})

rmqio.on('ack', async function (msg, ack, nack) {
  await ack()
})
rmqio.on('nack', async function (msg, ack, nack) {
  await nack("error")
})

rmqio
  .setServiceName('tester')
  .setRoute('test')
  .start()
  .then(() => {})

process.on('SIGINT', () => {
  rmqio.closeConn(function () {
    process.exit(1)
  })
})
