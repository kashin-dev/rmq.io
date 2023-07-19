const url =
  'amqps://sxdwecyw:ieW-YRP8AoBCnwX0NHFSvNgYSx1ou5Yy@possum.lmq.cloudamqp.com/sxdwecyw'
const { rmqio } = require('../dist')

const rmq = rmqio({
  url,
  preFetchingPolicy: 50,
  log: true,
  binarySerialization: true
  // quorumQueuesEnabled: true
})

rmq.addHook('start', data => {
  console.log('hook', data)
})

rmq.on(
  'rack',
  async function (msg, ack, nack) {
    console.log(msg)
    await ack()
    await nack()
  },
  true
)

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
    console.log(rmq.subscriptions)
    console.log(rmq.internalSubscriptions)
    for (let i = 0; i < 5; i++) {
      rmq.emitInternal('rack', { data: 'gata' })
    }
  })
  .catch(err => {
    console.log(err)
  })

process.on('SIGINT', () => {
  rmq.closeConn(function () {
    process.exit(1)
  })
})
