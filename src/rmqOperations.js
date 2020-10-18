// @flow
const fs = require('fs')
const amqp = require('amqplib/callback_api')

let conn: any
let chann: any

const config = {
  RECONN_TIMEOUT: 5000,
  PREFETCH: 10,
  HEARTBEAT: 60,
  CONN_ERROR_LOG: './msgBackUp.log',
  MSG_ERROR_LOG: './erroneusMsgs.log'
}

let connMsgStream
let erroneusMsgStream

/**
 * Deprecated, new function is `uvExceptionWithHostPort()`
 * New function added the error description directly
 * from C++. this method for backwards compatibility
 * @param {number} err - A libuv error number
 * @param {string} syscall
 * @param {string} address
 * @param {number} [port]
 * @param {string} [additional]
 * @returns {Error}
 */
function bindTo (ee) {
  for (const ce in ee.subscriptions) {
    chann.bindQueue(ee.queue, ee.exchange, ee.subscriptions[ce])
    chann.consume(ee.queue, function (msg) {
      const parsedMsg = parseMsg(msg)
      if (!parsedMsg) {
        // deflected messages that are not json
        deflectErroneusMessage(msg)
        return
      }
      ee.emit(
        msg.fields.routingKey,
        parsedMsg,
        () => { chann.ack(msg) },
        () => { chann.reject(msg) }
      )
    }, { noAck: false })
  }
}

/**
 * Conecta a la cola
 * @param url
 * @param ee
 * @param type
 * @param hb
 * @param pocef
 * @returns {Promise<any>}
 */
function connect (url, ee, type, hb, pocef) {
  return new Promise((resolve, reject) => {
    if (conn && chann) {
      reject(new Error('[AMQP] conn y chann are not set'))
      return
    }

    createDeflectorStream()
    createConnErrStream(pocef)
    amqp.connect(url + '?heartbeat=' + hb, function (err0, connection) {
      if (err0) {
        console.error('[AMQP]', err0)
        return setTimeout(connect, config.RECONN_TIMEOUT)
      }

      conn = connection

      conn.on('error', function (err) {
        if (err.message !== 'Connection closing') {
          console.error('[AMQP] conn error', err)
          reject(new Error(`[AMQP] conn error ${err}`))
        }
      })

      conn.on('close', function () {
        console.error('[AMQP] reconnecting')
        return setTimeout(connect, config.RECONN_TIMEOUT)
      })

      conn.createConfirmChannel(function (err1, channel) {
        if (closeOnErr(err1)) {
          reject(new Error(`[AMQP] conn error ${err1}`))
          return
        }
        chann = channel
        checkExchange(ee.exchange)
        if (type === 'sub') {
          checkQueue(ee.queue)
          bindTo(ee)
        }
        console.log('[AMQP] Connected...')
        ee.emit('connection', ee)
        resolve()
      })
    })
  })
}

function publish (exchange: string, topic: string, msg: Buffer) {
  return new Promise((resolve, reject) => {
    try {
      chann.publish(exchange, topic, msg, { persistent: true },
        function (err, ok) {
          if (err) {
            reject(err)
          }
          resolve(true)
        })
    } catch (e) {
      reject(e)
    }
  })
}

function close (cb) {
  erroneusMsgStream.end()
  connMsgStream.end()
  conn.close(function () {
    cb()
  })
}

function createConnErrStream (file) {
  connMsgStream = fs.createWriteStream(file, {
    flags: 'a'
  })
}

// eslint-disable-next-line no-unused-vars
function saveConnErrMessage (msg) {
  connMsgStream.write(
    msg.content.toString() + ' ' +
    JSON.stringify(msg.fields) + '\n'
  )
  chann.ack(msg)
}

function createDeflectorStream () {
  erroneusMsgStream = fs.createWriteStream(config.MSG_ERROR_LOG, {
    flags: 'a'
  })
}

function deflectErroneusMessage (msg) {
  erroneusMsgStream.write(
    msg.content.toString() + ' ' +
    JSON.stringify(msg.fields) + '\n'
  )
  chann.ack(msg)
}

function checkQueue (q) {
  chann.prefetch(config.PREFETCH)
  chann.assertQueue(q, {
    durable: true,
    function (err, _ok) {
      if (closeOnErr(err)) return
      console.log('Worker is started')
    }
  })
}

function checkExchange (ex) {
  if (!ex) return
  chann.assertExchange(ex, 'direct', {
    durable: true
  })
}

function closeOnErr (err) {
  if (!err) return false
  console.error('[AMQP] error', err)
  conn.close()
  return true
}

function parseMsg (msg) {
  let content: string
  let result
  try {
    content = msg.content.toString()
    result = JSON.parse(content)
    if (typeof result === 'number') { throw new Error('Message invalid type number') }
    if (result instanceof Array) { throw new Error('Message invalid type Array') }
  } catch (e) {
    console.error(e)
    result = null
  }
  return result
}

module.exports = {
  rmqconnect: connect,
  rmqpublish: publish,
  rmqclose: close,
  rmqconfig: config
}
