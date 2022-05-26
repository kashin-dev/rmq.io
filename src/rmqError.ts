enum ERROR_CODES {
  MSG_BAD_FORMAT = 1000,
  FAILED_CONNECTION
}

class RMQError extends Error {
  private code: number

  constructor(code: number, ...params: string[]) {
    super(...params)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RMQError)
    }
    this.code = code
  }
}

export class MsgBadFormat extends RMQError {
  constructor(...msg: string[]) {
    super(ERROR_CODES.MSG_BAD_FORMAT, ...msg)
  }
}

export class FailedConnection extends RMQError {
  constructor(...msg: string[]) {
    super(ERROR_CODES.FAILED_CONNECTION, ...msg)
  }
}
