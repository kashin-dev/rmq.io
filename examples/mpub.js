const url = 'amqp://dnvjewjo:X_aKJ-7N8GrSjQu0LUpVugJ_0G57IvHn@prawn.rmq.cloudamqp.com/dnvjewjo'
let { rmqio } = require('../dist/rmqio.js')

rmqio = rmqio({ url })

rmqio
  .setRoute('test')
  .start()
  .then(() => {
    rmqio.publish({
      hello: 'world'
    }, 'test')
  })

process.on('SIGINT', () => {
  rmqio.closeConn(function () {
    process.exit(1)
  })
})
