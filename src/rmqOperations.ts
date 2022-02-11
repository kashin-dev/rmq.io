import {
  Channel, connect,
  Connection
} from 'amqplib'
import {
  ConnectionType,
  json,
  Message, RMQ
} from './index'
import log from './logger'
import {
  FailedConnection, MsgBadFormat
} from './rmq_error'
import { decode } from '@msgpack/msgpack'
import log from './logger'
const logger = log()

let pubConn: Connection
let subConn: Connection
let pubChann: Channel
let subChann: Channel

export const RECONN_TIMEOUT = 5000
export const PREFETCH = 10
export const HEARTBEAT = 0

/**
 * Emit an event when a certain mesage arrives
 */
const bindTo = async (ee: RMQ) => {
  for (const ce in ee.subscriptions) {
    await subChann.bindQueue(ee.queue, ee.exchange, ee.subscriptions[ce])
    subChann.consume(ee.queue, function (msg) {
      const parsedMsg = parseMsg(msg, ee.binarySerialization)
      if (!parsedMsg) {
        throw new MsgBadFormat('Bad format message')
      }
      if (ee.log) { logger.info(`Received a message with content ${JSON.stringify(parsedMsg)}`) }

      ee.emit(
        msg.fields.routingKey,
        parsedMsg,
        async () => { subChann.ack(msg) },
        async (errorTopic = '') => { await nack(ee.exchange, errorTopic, subChann, msg) }
      )
    }, { noAck: false })
  }
}

const nack = async (
  exchange: string,
  topic = '',
  chann: Channel,
  msg: any
) => {
  if (topic === '') {
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
  pubConn = await connect(url)
  pubConn.on('error', (err) => {
    if (err.message !== 'Connection closing') {
      throw new FailedConnection(err)
    }
  })

  // conn.on('close', () => {})
  if (ee.log) { logger.info('Connected to RabbitMQ') }

  pubChann = await pubConn.createConfirmChannel()
  checkExchange(ee.exchange)
  if (type === 'sub') {
    subConn = await connect(url)
    subChann = await subConn.createChannel()
    checkExchange(ee.exchange)
    checkQueue(ee.queue, qqe, ee.prefetchPolicy)
    bindTo(ee)
  }
}

export const rmqpublish = (
  exchange: string,
  topic: string,
  msg: Buffer
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (pubChann.publish(exchange, topic, msg, { persistent: true })) {
      resolve(true)
    } else {
      reject(new Error())
    }
  })
}

export const rmqclose = async (
  cb: (...params: any[]) => any
): Promise<void> => {
  cb()
  await pubConn.close()
  await subConn.close()
}

const checkQueue = async (q: string, qqe: boolean, prefetch: number) => {
  subChann.prefetch(prefetch)
  const options = {
    durable: true
  }

  if (qqe) {
    Object.defineProperty(
      options,
      'arguments',
      {
        value: { // for dedicated plans xD
          'x-queue-type': 'quorum'
        }
      }
    )
  }

  try {
    await subChann.assertQueue(
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
  await pubChann.assertExchange(ex, 'direct', {
    durable: true
  })
}

const closeOnErr = async (err: Error) => {
  if (!err) return false
  await pubConn.close()
  await subConn.close()
}

const parseMsg = (msg: Message<json | Buffer>, binarySerialized: boolean): json => {
  let result: json = {}
  if (binarySerialized) {
    const contentBinary = msg.content as Buffer
    result = decode(contentBinary)
  } else {
    msg.content as json
    const content = msg.content.toString()
    result = JSON.parse(content)
  }
  if (typeof result === 'number') {
    throw new MsgBadFormat('Message invalid type number')
  }
  if (result instanceof Array) {
    throw new MsgBadFormat('Message invalid type Array')
  }
  return result
}
