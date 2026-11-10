const waitForConfirms = jest.fn(async () => true)

const publishChannel = {
  on: jest.fn(),
  assertExchange: jest.fn(async () => true),
  assertQueue: jest.fn(async () => ({ queue: '' })),
  bindQueue: jest.fn(async () => true),
  consume: jest.fn(async () => ({ consumerTag: 'c' })),
  publish: jest.fn(
    (_exchange: string, _topic: string, _buffer: Buffer, _options: unknown, cb: Function) =>
      cb(undefined, true)
  ),
  ack: jest.fn(),
  nack: jest.fn(),
  reject: jest.fn(),
  prefetch: jest.fn(),
  waitForConfirms
}

const on = jest.fn()
const close = jest.fn(async () => undefined)

const connect = jest.fn(async () => ({
  on,
  close,
  createConfirmChannel: jest.fn(async () => publishChannel),
  createChannel: jest.fn(async () => publishChannel)
}))

const fake = {
  connect,
  publishChannel,
  on,
  close,
  waitForConfirms
}

export default fake
