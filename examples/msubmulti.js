const url = 'amqp://localhost'
const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  preFetchingPolicy: 50,
  // log: true,
  binarySerialization: true
  // quorumQueuesEnabled: true
})

rmq.addHook('start', data => {
  console.log('hook', data)
})

rmq.on('ack', async function (msg, ack, nack) {
  console.log('old listener', msg)
  await ack()
})
rmq.on2(['a', 'b', 'c'], async function (msg, ack, nack) {
  console.log('same listener', msg)
  await ack()
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
