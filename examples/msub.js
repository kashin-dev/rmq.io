const url = 'amqp://guest:guest@localhost:5672'
const { rmqio } = require('../dist')

const connection = rmqio({
  url,
  preFetchingPolicy: 50,
  log: true,
  binarySerialization: true
  // quorumQueuesEnabled: true
})

connection.on('ack', async function (msg, ack, nack) {
  await ack()
})
connection.on('nack', async function (msg, ack, nack) {
  await nack('error')
})

connection
  .setServiceName('tester')
  .setRoute('kashin staging')
  .start()
  .then((res) => {
    console.log(res)
  }).catch((err) => {
    console.log(err)
  })

process.on('SIGINT', () => {
  connection.closeConn(function () {
    process.exit(1)
  })
})
