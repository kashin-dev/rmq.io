/**
 * Conecta a la cola
 * @param url
 * @param ee
 * @param type
 * @param hb
 * @param pocef
 * @returns {Promise<any>}
 */
declare function connect(
  url: any,
  ee: any,
  type: any,
  hb: any,
  pocef: any
): Promise<any>
declare function publish(exchange: string, topic: string, msg: any): any
declare function close(cb: any): void
declare namespace config {
  const RECONN_TIMEOUT: number
  const PREFETCH: number
  const HEARTBEAT: number
  const CONN_ERROR_LOG: string
  const MSG_ERROR_LOG: string
}
export {
  connect as rmqconnect,
  publish as rmqpublish,
  close as rmqclose,
  config as rmqconfig
}
