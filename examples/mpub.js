const url = 'amqp://localhost'
let {rmqio} = require('../dist')

rmqio = rmqio({url})

rmqio
  .setRoute('test')
  .start()
  .then(async () => {
    const res = await rmqio.publish({
      content: {
        hello: 'world'
      }
    }, 'test')
    console.log(res)
  })

process.on('SIGINT', () => {
  rmqio.closeConn(function () {
    process.exit(1)
  })
})
