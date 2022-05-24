import * as pino from 'pino'
let logger: pino.Logger

export default (): pino.Logger => {
  if (!logger) {
    logger = pino()
  }

  return logger
}
