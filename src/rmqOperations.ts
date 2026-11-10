import { Channel, connect, ConfirmChannel, ChannelModel } from 'amqplib'
import { ConnectionType, Message, json, RMQ } from './index'
import { FailedConnection, MsgBadFormat } from './rmqError'
import { decode } from '@msgpack/msgpack'
import log from './logger'
const logger = log()

let pubConn: ChannelModel
let subConn: ChannelModel
let pubChann: ConfirmChannel
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
    subChann.consume(
      ee.queue,
      function (msg) {
        let parsedMsg: json
        try {
          parsedMsg = parseMsg(msg, ee.binarySerialization)
        } catch (e) {
          throw new MsgBadFormat('Failed to parse msg')
        }
        if (ee.log) {
          logger.info(msg, 'parsedMsg')
        }
        ee.emit(
          msg.fields.routingKey,
          parsedMsg,
          async () => {
            subChann.ack(msg)
          },
          async (errorTopic = '') => {
            await nack(ee.exchange, errorTopic, subChann, msg)
          }
        )
      },
      { noAck: false }
    )
  }
}

const nack = async (exchange: string, topic = '', chann: Channel, msg: any) => {
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
  // amqplib v2: heartbeat 0 explicitly disables heartbeats in TuneOk.
  // Only add the heartbeat connection parameter when a positive value
  // is configured, otherwise let the server decide (previous default).
  const connUrl =
    hb > 0 ? `${url}${url.includes('?') ? '&' : '?'}heartbeat=${hb}` : url
  pubConn = await connect(connUrl)
  pubConn.on('error', err => {
    if (err.message !== 'Connection closing') {
      throw new FailedConnection(err.message)
    }
  })

  // conn.on('close', () => {})
  if (ee.log) {
    logger.info('Connected to RabbitMQ')
  }

  pubChann = await pubConn.createConfirmChannel()
  pubChann.on('error', () => undefined)
  await checkExchange(ee.exchange)
  if (type === 'sub') {
    subConn = await connect(connUrl)
    subChann = await subConn.createChannel()
    subChann.on('error', () => undefined)
    await checkExchange(ee.exchange)
    await checkQueue(ee.queue, qqe, ee.prefetchPolicy)
    await bindTo(ee)
  }
}

export const rmqpublish = (
  exchange: string,
  topic: string,
  buffer: Buffer
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    pubChann.publish(
      exchange,
      topic,
      buffer,
      { persistent: true },
      (err, ok) => {
        if (err) reject(err)
        resolve(true)
      }
    )
  })
}

export const waitOnConfirms = (): Promise<boolean> => {
  // amqplib v2: waitForConfirms rejects when the channel closes
  // with unconfirmed messages, so the rejection must be propagated.
  return pubChann.waitForConfirms().then(() => true)
}

export const rmqclose = async (
  cb: (...params: any[]) => any
): Promise<void> => {
  cb()
  await pushChannConfirms().catch(() => undefined)

  await pubConn.close()
  if (subConn) await subConn.close()
}

const pushChannConfirms = async (): Promise<void> => {
  if (pubChann) await pubChann.waitForConfirms()
}

const checkQueue = async (q: string, qqe: boolean, prefetch: number) => {
  subChann.prefetch(prefetch)
  const options = {
    durable: true
  }

  if (qqe) {
    Object.defineProperty(options, 'arguments', {
      value: {
        // for dedicated plans xD
        'x-queue-type': 'quorum'
      }
    })
  }

  try {
    await subChann.assertQueue(q, options)
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

export const parseMsg = (
  msg: Message<json | Buffer>,
  binarySerialized: boolean
): json => {
  let result: json = {}
  if (binarySerialized) {
    const contentBinary = msg.content as Buffer
    result = decode(contentBinary) as json
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
