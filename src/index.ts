import {
  rmqconnect,
  rmqpublish,
  rmqclose,
  rmqconfig
} from './rmqOperations.js'

import * as events from 'events'
import {listeners} from 'cluster'

// @flow
let RMQSingleton: RMQ
declare interface Options {
  url: string,
  reconnTime?: number,
  preFetchingPolicy?: number,
  heartBeat?: number,
  persistFileOnConnError?: string
}

export declare type json = {
  [key: string]: any;
}
export declare type Message<T> = {
  topic?: string,
  content: T
}

export class RMQ extends events.EventEmitter {
  private url: string
  private queue: string
  private subscriptions: string[]
  private exchange: string
  private type: 'pub' | 'sub'
  private reconnTime: number
  private prefetchPolicy: number
  private heartBeat: number
  private persistToFile: string

  constructor(options: Options) {
    super()
    this.url = options.url
    this.reconnTime = options.reconnTime
    this.prefetchPolicy = options.preFetchingPolicy
    this.heartBeat = options.heartBeat
    this.persistToFile = options.persistFileOnConnError
    this.subscriptions = []
  }

  on(ev: string, listener: (...args: any[]) => void): this {
    this.subscribe(ev)
    return super.on(ev, listener)
  }

  setServiceName(q: string): RMQ {
    this.queue = q
    return this
  }

  setRoute(e: string): RMQ {
    this.exchange = e
    return this
  }

  subscribe(...args: string[]): RMQ {
    if (this.type === 'pub') return
    if (arguments.length === 0) {
      throw new Error('You must be  subscribed to a topic to receive messages')
    }
    const unique = args.filter(
      (a: string) => !this.subscriptions.includes(a)
    )
    Array.prototype.push.apply(
      this.subscriptions,
      unique
    )
    return this
  }

  /**
  * Valida si el mensaje es registrado
  * @param {Message} message
  * TODO: make an interface definition for a message
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
  publish(
    message: Message<string | json | number>,
    topic = 'default'
  ): Promise<any> {
    let buf: Buffer
    if (typeof message.content === "string") {
      buf = Buffer.from(message.content)
    } else if (typeof message.content === "number") {
      buf = Buffer.from(
        message.content.toString()
      )
    } else {
      //JSON 
      buf = Buffer.from(
        JSON.stringify(
          <json>message.content
        )
      )
    }

    if (message.topic)
      topic = message.topic

    return rmqpublish(this.exchange, topic, buf)
  }

  closeConn(cb: any): void {
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
