const url = 'amqp://localhost'
const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  preFetchingPolicy: 50,
  log: true,
  binarySerialization: true
  // quorumQueuesEnabled: true
})

rmq.on('ack', async function (msg, ack, nack) {
  await ack()
})
rmq.on('nack', async function (msg, ack, nack) {
  await nack('error')
})

rmq
  .setServiceName('tester')
  .setRoute('test')
  .start()
  .then(res => {
    console.log(res)
  })
  .catch(err => {
    console.log(err)
  })

process.on('SIGINT', () => {
  rmq.closeConn(function () {
    process.exit(1)
  })
})
