import {
  rmqconnect,
  rmqpublish,
  rmqclose,
  rmqconfig
} from './rmqOperations.js'

import * as events from 'events'

// @flow
let RMQSingleton: any
interface Options {
  url: string,
  reconnTime?: number,
  preFetchingPolicy?: number,
  heartBeat?: number,
  persistFileOnConnError?: string
}

class RMQ extends events.EventEmitter {
  url: string
  queue: string
  subscriptions: string[]
  exchange: string
  type: 'pub' | 'sub'
  reconnTime: number
  prefetchPolicy: number
  heartBeat: number
  persistToFile: string

  constructor(options) {
    super()
    this.url = options.url
    this.reconnTime = options.reconnTime
    this.prefetchPolicy = options.preFetchingPolicy
    this.heartBeat = options.heartBeat
    this.persistToFile = options.persistFileOnConnError
  }

  setServiceName(q: string) {
    this.queue = q
    return this
  }

  setRoute(e: string) {
    this.exchange = e
    return this
  }

  subscribe(...arg: string[]) {
    if (this.type === 'pub') return
    if (arguments.length === 0) {
      throw new Error('You must be  subscribed to a topic to receive messages')
    }
    this.subscriptions = arg
    return this
  }

  /**
 * Valida si el mensaje es registrado
 * @param {Message} message
 */
  getValidJSONMessage(message: string): any {
    let jsonMsg
    try {
      jsonMsg = JSON.stringify(message)
    } catch (e) {
      throw new Error('The message is not valid JSON')
    }
    return jsonMsg
  }

  /**
   * @param {Message} message
   */
  publish(message: string, topic = 'default') {
    const buffmsg = Buffer.from(this.getValidJSONMessage(message))
    return rmqpublish(this.exchange, topic, buffmsg)
  }

  closeConn(cb) {
    rmqclose(cb)
  }

  start(): Promise<any> {
    if (!this.queue && !this.exchange) {
      throw new Error('An exchange defined is mandatory for this library')
    }
    if (this.queue && !this.subscriptions) {
      throw new Error('Subscribe to some topics')
    }
    return rmqconnect(
      this.url,
      this,
      (!this.queue) ? 'pub' : 'sub',
      this.heartBeat,
      this.persistToFile
    )
    // return this
  }
}

export function rmqio(opt: Options): RMQ {
  if (RMQSingleton) {
    return RMQSingleton
  }

  const options: Options = opt

  options.reconnTime =
    options.reconnTime || rmqconfig.RECONN_TIMEOUT
  options.preFetchingPolicy =
    options.preFetchingPolicy || rmqconfig.PREFETCH
  options.heartBeat =
    options.heartBeat || rmqconfig.HEARTBEAT
  options.persistFileOnConnError =
    options.persistFileOnConnError || rmqconfig.CONN_ERROR_LOG
  /**
   * {
   *  url:,
   *  reconnTime:,
   *  preFetchPolicy:,
   *  heartBeat:,
   *  persistFileOnConnError:
   * }
   */
  if (!RMQSingleton) {RMQSingleton = new RMQ(options)}

  return RMQSingleton
}
