import {
  connect,
  Connection,
  Channel,
} from 'amqplib'
import {
  RMQ,
  ConnectionType,
  json,
  Message
} from './index'
import {
  MsgBadFormat,
  FailedConnection
} from './rmq_error'

import log from './logger'
const logger = log()

let conn: Connection
let chann: Channel

export const RECONN_TIMEOUT = 5000
export const PREFETCH = 10
export const HEARTBEAT = 60

/**
 * Emit an event when a certain mesage arrives
 */
const bindTo = async (ee: RMQ) => {
  for (const ce in ee.subscriptions) {
    await chann.bindQueue(ee.queue, ee.exchange, ee.subscriptions[ce])
    chann.consume(ee.queue, function (msg) {

      const parsedMsg = parseMsg(msg)
      if (!parsedMsg) {
        throw new MsgBadFormat("Bad format message")
      }
      if (ee.log)
        logger.info(`Received a message with content ${JSON.stringify(parsedMsg)}`)

      ee.emit(
        msg.fields.routingKey,
        parsedMsg,
        async () => {chann.ack(msg)},
        async (errorTopic = "") => {await nack(ee.exchange, errorTopic, chann, msg)}
      )
    }, {noAck: false})
  }
}

const nack = async (
  exchange: string,
  topic = "",
  chann: Channel,
  msg: any
) => {
  if (topic === "") {
    chann.reject(msg)
    return
  }

  const buffMsg = Buffer.from(msg.content.toString())
  rmqpublish(exchange, topic, buffMsg)
  chann.ack(msg)
}

export const rmqconnect = async (
  url: string,
  ee: RMQ,
  type: ConnectionType,
  hb: number,
  qqe: boolean
): Promise<void> => {

  conn = await connect(url + '?heartbeat=' + hb)
  conn.on('error', (err) => {
    if (err.message !== 'Connection closing') {
      throw new FailedConnection(err)
    }
  })

  //conn.on('close', () => {})
  if (ee.log)
    logger.info(`Connected to RabbitMQ`)


  chann = await conn.createConfirmChannel()
  checkExchange(ee.exchange)
  if (type === 'sub') {
    checkQueue(ee.queue, qqe)
    bindTo(ee)
  }
}

export const rmqpublish = (
  exchange: string,
  topic: string,
  msg: Buffer
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (chann.publish(exchange, topic, msg, {persistent: true})) {
      resolve(true)
    } else {
      reject()
    }
  })
}

export const rmqclose = async (
  cb: (...params: any[]) => any
): Promise<void> => {
  cb()
  await conn.close()
}

const checkQueue = async (q: string, qqe: boolean) => {
  chann.prefetch(PREFETCH)
  const options = {
    durable: true,
  }

  if (qqe) {
    Object.defineProperty(
      options,
      "arguments",
      {
        value: { // for dedicated plans xD
          "x-queue-type": "quorum"
        }
      }
    )
  }

  try {
    await chann.assertQueue(
      q,
      options
    )
  } catch (e) {
    closeOnErr(e)
    throw e
  }
}

const checkExchange = async (ex: string) => {
  if (!ex) return
  await chann.assertExchange(ex, 'direct', {
    durable: true
  })
}

const closeOnErr = async (err: Error) => {
  if (!err) return false
  await conn.close()
}

const parseMsg = (msg: Message<json>): json => {

  const content = msg.content.toString()
  const result = JSON.parse(content)

  if (typeof result === 'number') {
    throw new MsgBadFormat('Message invalid type number')
  }
  if (result instanceof Array) {
    throw new MsgBadFormat('Message invalid type Array')
  }
  return result
}
