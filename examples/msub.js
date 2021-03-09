const url = 'amqps://clbjcayi:D9PgO4nzvgZUVptpEr5_QL9T6DVc1_Lj@shark.rmq.cloudamqp.com/clbjcayi'

let {rmqio} = require('../dist')

rmqio = rmqio({
  url: url,
  preFetchingPolicy: 50,
  log: true
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
