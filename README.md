# rmqio

### Subscriber

```js
const { rmqio } = require('rmq.io')
const url = 'amqp://URLRABBITMQ'
rmqio = rmqio({ url: url })

rmqio.on('connection', function (socket) {
  console.log('connected')
})

rmqio.on(Message.UserCreate.topic(), function (msg, ack, nack) {
  console.log(msg)
  ack()
})

// Initialize
rmqio
  .setServiceName('SERVICE_NAME')// microservice name. A queue will be created
  .setRoute('ROUTE')// Exchange name
  .subscribe('test')
  .start()

process.on('SIGINT', () => {
  rmqio.closeConn()
  process.exit(1)
})
```

### Publisher

```js
let { rmqio } = require('rmq.io')
const url = 'amqp://URLRABBITMQ'
rmqio = rmqio({ url: url })

rmqio
  .setRoute('router')
  .start()
  .then(() => {
    rmqio.publish({ hello: 'world' })
  })

process.on('SIGINT', () => {
  rmqio.closeConn()
  process.exit(1)
})
```
