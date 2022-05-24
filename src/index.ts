import * as events from 'events'
import log from './logger'
import {
  HEARTBEAT,
  PREFETCH,
  RECONN_TIMEOUT,
  rmqclose,
  rmqconnect,
  rmqpublish
} from './rmqOperations.js'
import { encode } from '@msgpack/msgpack'

const logger = log()

export declare type ConnectionType = 'pub' | 'sub'

declare interface Options {
  url: string
  reconnTime?: number
  preFetchingPolicy?: number
  heartBeat?: number
  persistFileOnConnError?: string
  log?: boolean
  quorumQueuesEnabled?: boolean
  binarySerialization?: boolean
}

export declare type json = {
  [key: string]: any
}
export declare type Message<T> = {
  topic?: string
  content: T
}

export class RMQ extends events.EventEmitter {
  private url: string
  public queue: string
  public subscriptions: string[]
  public exchange: string
  private type: 'pub' | 'sub'
  private reconnTime: number
  public prefetchPolicy: number
  public heartBeat: number
  public persistToFile: string
  public log: boolean
  public quorumQueuesEnabled: boolean
  public binarySerialization: boolean

  /**
   * Creates the base object for rmq.io.
   *
   * @param {Options} options
   * @package
   */
  constructor(options: Options) {
    super()
    this.url = options.url
    this.reconnTime = options.reconnTime
    this.prefetchPolicy = options.preFetchingPolicy
    this.heartBeat = options.heartBeat
    this.persistToFile = options.persistFileOnConnError
    this.subscriptions = []
    this.log = options.log
    this.quorumQueuesEnabled = options.quorumQueuesEnabled
    this.binarySerialization = options.binarySerialization
  }

  /**
   * Creates a listener to a RabbitMQ topic. You will receive messages here for one topic.
   *
   * @param {string} ev
   * @public
   */
  on(ev: string, listener: (...args: any[]) => void): this {
    this.subscribe(ev)
    if (this.log) {
      logger.info(`Subscribed to ${ev}`)
    }

    return super.on(ev, listener)
  }

  /**
   * A service must have a name, so that a work queue is created for it to listen to arriving messages.
   *
   * @param {string} q
   * @return self
   * @public
   */
  setServiceName(q: string): RMQ {
    this.queue = q

    return this
  }

  /**
   * To publish messages you need an exchange name(we call it route), this exchange is used as the broker between several services connected to the same route.
   *
   * @param {string} e
   * @return self
   * @public
   */
  setRoute(e: string): RMQ {
    this.exchange = e

    return this
  }

  /**
   * Support methos for the on listener definition method.
   *
   * @param {string[]} args
   * @return self
   * @private
   */
  private subscribe(...args: string[]): RMQ {
    if (this.type === 'pub') return
    if (arguments.length === 0) {
      throw new Error('You must be  subscribed to a topic to receive messages')
    }
    const unique = args.filter((a: string) => !this.subscriptions.includes(a))

    Array.prototype.push.apply(this.subscriptions, unique)

    return this
  }

  /**
   * Checks if a msg is valid json.
   *
   * @param {string} message
   * @return json
   * @private
   */

  private getValidJSONMessage(message: string): string {
    try {
      const jsonMsg = JSON.stringify(message)

      return jsonMsg
    } catch (e) {
      throw new Error('The message is not valid JSON')
    }
  }

  /**
   * Publish a message, you have to set topic and content of the message
   *
   * @param {Message<T>} message
   * @return Promise
   * @public
   */
  publish(
    message: Message<string | json | number>,
    topic = 'default'
  ): Promise<any> {
    let buf: Buffer
    if (typeof message.content === 'string') {
      buf = Buffer.from(message.content)
    } else if (typeof message.content === 'number') {
      buf = Buffer.from(message.content.toString())
    }

    if (this.binarySerialization) {
      const encoded = encode(message.content)
      buf = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
    } else {
      // raw strings transmited through the wire
      buf = Buffer.from(JSON.stringify(<json>message.content))
    }
    if (message.topic) {
      topic = message.topic
    }
    if (this.log) {
      logger.info(
        `Publish message ${JSON.stringify(message.content)} with topic ${topic}`
      )
    }

    return rmqpublish(this.exchange, topic, buf)
  }

  /**
   * Close the connection with RabbitMQ. You can set a callback to be excetuded.
   *
   * @param {any[]} params
   * @return Promise
   * @public
   */
  async closeConn(cb: (...params: any[]) => any): Promise<void> {
    if (this.log) {
      logger.info('Closing connection')
    }
    await rmqclose(cb)
  }

  /**
   * Start to listen for messages.
   *
   * @return Promise
   * @public
   */
  start(): Promise<any> {
    if (!this.queue && !this.exchange) {
      throw new Error('An exchange defined is mandatory for this library')
    }
    if (this.queue && !this.subscriptions) {
      throw new Error('Subscribe to some topics')
    }
    if (this.log) {
      logger.info('Connecting')
    }

    return rmqconnect(
      this.url,
      this,
      !this.queue ? 'pub' : 'sub',
      this.heartBeat,
      this.quorumQueuesEnabled
    )
    // return this
  }
}

let RMQSingleton: RMQ

export function rmqio(opt: Options): RMQ {
  if (RMQSingleton) {
    return RMQSingleton
  }

  const options: Options = opt

  options.reconnTime = options.reconnTime || RECONN_TIMEOUT
  options.preFetchingPolicy = options.preFetchingPolicy || PREFETCH
  options.heartBeat = options.heartBeat || HEARTBEAT
  options.persistFileOnConnError = null
  options.log = options.log || false
  options.quorumQueuesEnabled = options.quorumQueuesEnabled || false
  options.binarySerialization = options.binarySerialization || false
  /**
   * {
   *  url:,
   *  reconnTime:,
   *  preFetchPolicy:,
   *  heartBeat:,
   *  persistFileOnConnError:,
   *  log:
   * }
   */
  if (!RMQSingleton) {
    RMQSingleton = new RMQ(options)
  }

  return RMQSingleton
}
