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
const hooks = [
  'publish',
  'consume',
  'prePublish',
  'preConsume',
  'start',
  'stop'
]

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

export declare type Message<T> = {
  content: T
  topic?: string
}

export type json = Record<string, unknown>

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
  private hooks = new Map()

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
    hooks.forEach(hook => this.hooks.set(hook, Symbol('')))
  }

  addHook<T extends Record<string, unknown>, S = unknown>(
    hookName: string,
    listener: (args: T) => Promise<S> | S
  ): void {
    if (!this.hooks.get(hookName))
      throw new Error(`Hook not found use any of ${hooks}`)

    this.on(this.hooks.get(hookName), listener)
  }

  /**
   * Creates a listener to a RabbitMQ topic. You will receive messages here for one topic.
   *
   * @param {string} ev
   * @param {(args: T) => void} listener
   * @public
   */
  on<T extends Record<string, unknown>>(
    ev: string | symbol,
    listener: (args: T) => void
  ): this {
    if (typeof ev !== 'symbol') this.subscribe(ev as string)

    if (this.log && typeof ev !== 'symbol')
      logger.info(`Subscribed to ${ev as string}`)

    return super.on(ev, listener)
  }

  /**
   * Creates one listener for one or more RabbitMQ topic(s). You will receive messages here for N topics.
   *
   * @param {string[]} evs
   * @param {(args: T) => void} listener
   * @public
   */
  on2<T extends Record<string, unknown>>(
    evs: string[],
    listener: (args: T) => void
  ): this {
    evs.forEach(topic => {
      this.subscribe(topic)
      super.on(topic, listener)
    })
    if (this.log) logger.info(`Subscribed to group ${evs.join(',')}`)

    return this
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
   * Support methods for the on listener definition method.
   *
   * @param {string[]} args
   * @return self
   * @private
   */
  private subscribe(...args: string[]): RMQ {
    if (this.type === 'pub') return

    if (arguments.length === 0)
      throw new Error('You must be  subscribed to a topic to receive messages')

    const unique = args.filter((a: string) => !this.subscriptions.includes(a))

    Array.prototype.push.apply(this.subscriptions, unique)

    return this
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
  ): Promise<boolean> {
    let buffer: Buffer

    if (this.log)
      logger.info(
        `Publish message ${JSON.stringify(message.content)} with topic ${topic}`
      )

    if (this.binarySerialization) {
      const encoded = encode(message.content)

      buffer = Buffer.from(
        encoded.buffer,
        encoded.byteOffset,
        encoded.byteLength
      )
    } else if (typeof message.content === 'string')
      buffer = Buffer.from(message.content)
    else if (typeof message.content === 'number')
      buffer = Buffer.from(message.content.toString())
    else if (typeof message.content === 'object')
      buffer = Buffer.from(JSON.stringify(message.content))

    if (message.topic) topic = message.topic

    this.emit(this.hooks.get('publish'), { message, topic })

    return rmqpublish(this.exchange, topic, buffer)
  }

  /**
   * Close the connection with RabbitMQ. You can set a callback to be excetuded.
   *
   * @param {any[]} params
   * @return Promise
   * @public
   */
  async closeConn(cb: (...params: any[]) => any): Promise<void> {
    if (this.log) logger.info('Closing connection')

    await rmqclose(cb)
    this.emit(this.hooks.get('stop'))
  }

  /**
   * Start to listen for messages.
   *
   * @return Promise
   * @public
   */
  start(): Promise<any> {
    if (!this.queue && !this.exchange)
      throw new Error('An exchange defined is mandatory for this library')

    if (this.queue && !this.subscriptions)
      throw new Error('Subscribe to some topics')

    if (this.log) logger.info('Connecting')

    this.emit(this.hooks.get('start'), {
      queue: this.queue,
      exchange: this.exchange
    })

    return rmqconnect(
      this.url,
      this,
      !this.queue ? 'pub' : 'sub',
      this.heartBeat,
      this.quorumQueuesEnabled
    )
  }
}

let RMQSingleton: RMQ

export function rmqio(opt: Options): RMQ {
  if (RMQSingleton) return RMQSingleton

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
  if (!RMQSingleton) RMQSingleton = new RMQ(options)

  return RMQSingleton
}
