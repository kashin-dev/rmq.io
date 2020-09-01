const { rmqconnect, rmqpublish, rmqclose, rmqconfig } = require('./rmqOperations.js')
const EventEmitter = require('events')

// @flow
let RMQSingleton: any

class RMQ extends EventEmitter {
  url: string
  queue: string
  subscriptions: Array<string>
  exchange: string
  type: 'pub' | 'sub'

  constructor (options) {
    super()
    this.url = options.url
    this.reconnTime = options.reconnTime
    this.prefetchPolicy = options.preFetchingPolicy
    this.heartBeat = options.heartBeat
    this.persistToFile = options.persistFileOnConnError
  }

  setServiceName (q: string) {
    this.queue = q
    return this
  }

  setRoute (e: string) {
    this.exchange = e
    return this
  }

  subscribe () {
    if (this.type === 'pub') return
    if (arguments.length === 0) {
      throw new Error('You must be  subscribed to a topic to receive messages')
    }
    this.subscriptions = arguments
    return this
  }

  /**
 * Valida si el mensaje es registrado
 * @param {Message} message
 */
  getValidJSONMessage (message) {
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
  publish (message, topic = 'default') {
    const buffmsg = Buffer.from(this.getValidJSONMessage(message))
    rmqpublish(this.exchange, topic, buffmsg)
  }

  closeConn (cb) {
    rmqclose(cb)
  }

  /**
   * Inicializa la conexión hacia la Cola
   * @returns {Promise<any>}
   */
  start () {
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

function rmqio (opt) {
  if (RMQSingleton) {
    return RMQSingleton
  }
  var options: {
    url: string,
    reconnTime?: number,
    preFetchingPolicy?: number,
    heartBeat?: number,
    persistFileOnConnError?: string
  } = opt

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
  if (!RMQSingleton) { RMQSingleton = new RMQ(options) }

  return RMQSingleton
}

module.exports = {
  rmqio
}
