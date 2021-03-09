const url = 'amqps://clbjcayi:D9PgO4nzvgZUVptpEr5_QL9T6DVc1_Lj@shark.rmq.cloudamqp.com/clbjcayi'
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
