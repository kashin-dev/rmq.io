import {
  rmqconnect,
  rmqpublish,
  rmqclose,
  PREFETCH,
  HEARTBEAT,
  RECONN_TIMEOUT
} from './rmqOperations.js'

import * as events from 'events'
import log from './logger'
const logger = log()


let RMQSingleton: RMQ

export declare type ConnectionType = "pub" | "sub"

declare interface Options {
  url: string,
  reconnTime?: number,
  preFetchingPolicy?: number,
  heartBeat?: number,
  persistFileOnConnError?: string
  log?: boolean
  quorumQueuesEnabled?: boolean
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
  }

  /**
   * Creates a listener to a RabbitMQ topic. You will receive messages here for one topic.
   *
   * @param {string} ev
   * @public
   */
  on(ev: string, listener: (...args: any[]) => void): this {
    this.subscribe(ev)
    if (this.log)
      logger.info(`Subscribed to ${ev}`)

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
       * Checks if a msg is valid json.
       *
       * @param {string} message
       * @return json
       * @private
       */

  private getValidJSONMessage(message: string): string {
    let jsonMsg: string
    try {
      jsonMsg = JSON.stringify(message)
    } catch (e) {
      throw new Error('The message is not valid JSON')
    }
    return jsonMsg
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

    if (this.log)
      logger.info(`Publish message ${JSON.stringify(message.content)} with topic ${topic}`)

    return rmqpublish(this.exchange, topic, buf)
  }

  /**
        * Close the connection with RabbitMQ. You can set a callback to be excetuded.
        *
        * @param {any[]} params
        * @return Promise
        * @public
        */
  async closeConn(
    cb: (...params: any[]) => any
  ): Promise<void> {
    if (this.log)
      logger.info("Closing connection")
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
    if (this.log)
      logger.info("Connecting")
    return rmqconnect(
      this.url,
      this,
      (!this.queue) ? 'pub' : 'sub',
      this.heartBeat,
      this.quorumQueuesEnabled
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
    options.reconnTime || RECONN_TIMEOUT
  options.preFetchingPolicy =
    options.preFetchingPolicy || PREFETCH
  options.heartBeat =
    options.heartBeat || HEARTBEAT
  options.persistFileOnConnError = null
  options.log = options.log || false
  options.quorumQueuesEnabled = options.quorumQueuesEnabled || false
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
  if (!RMQSingleton) {RMQSingleton = new RMQ(options)}

  return RMQSingleton
}
