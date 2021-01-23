const url = 'amqps://localhost'

let {rmqio} = require('../dist')

rmqio = rmqio({
  url: url,
  preFetchingPolicy: 50
})

rmqio.on('ack', async function (msg, ack, nack) {
  console.log(msg)
  await ack()
})
rmqio.on('nack', async function (msg, ack, nack) {
  console.log(msg)
  await nack("error")
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
