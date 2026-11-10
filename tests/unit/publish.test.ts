import { rmqio } from '../../src/index'

const URL = 'amqp://guest:guest@localhost:5672'

jest.mock('amqplib', () => require('./amqpFake').default)

interface Ctx {
  mod: any
  amqp: any
}

function makeSvcWith(
  options: Record<string, unknown> = {}
): { svc: any; amqp: any } {
  let svc: any
  let amqp: any
  jest.isolateModules(() => {
    amqp = require('amqplib')
    const mod: any = require('../../src/index')
    svc = mod.rmqio({ url: URL, ...options })
  })
  return { svc, amqp }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('publish', () => {
  it('buffers string content and resolves true', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    await expect(svc.publish({ content: 'hi' }, 't.str')).resolves.toBe(true)
    expect(amqp.publishChannel.publish).toHaveBeenCalledWith(
      'ex',
      't.str',
      Buffer.from('hi'),
      { persistent: true },
      expect.any(Function)
    )
  })

  it('buffers number content', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    await svc.publish({ content: 5 }, 't.num')
    expect(amqp.publishChannel.publish.mock.calls[0][2].toString()).toBe('5')
  })

  it('buffers object content as JSON', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    await svc.publish({ content: { a: 1 } }, 't.json')
    expect(amqp.publishChannel.publish.mock.calls[0][2].toString()).toBe(
      '{"a":1}'
    )
  })

  it('default topic is "default"', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    await svc.publish({ content: 'x' })
    expect(amqp.publishChannel.publish.mock.calls[0][1]).toBe('default')
  })

  it('message.topic overrides the topic argument', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    await svc.publish({ content: 'y', topic: 'override' }, 'ignored')
    expect(amqp.publishChannel.publish.mock.calls[0][1]).toBe('override')
  })

  it('encodes content as msgpack when binarySerialization is on', async () => {
    const { svc, amqp } = makeSvcWith({ binarySerialization: true })
    svc.setRoute('ex')
    await svc.start()
    await svc.publish({ content: { z: 9 } }, 't.bin')
    const { decode } = await import('@msgpack/msgpack')
    expect(decode(amqp.publishChannel.publish.mock.calls[0][2])).toEqual({
      z: 9
    })
  })

  it('fires the publish hook with the message and topic', async () => {
    const { svc } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    const hook = jest.fn()
    svc.addHook('publish', hook)
    await svc.publish({ content: 'z' }, 't.hook')
    expect(hook).toHaveBeenCalledWith({
      message: { content: 'z' },
      topic: 't.hook'
    })
  })

  it('waitConfirms resolves via the confirm channel', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    await expect((svc as any).waitConfirms()).resolves.toBeUndefined()
    expect(amqp.publishChannel.waitForConfirms).toHaveBeenCalled()
  })
})

describe('rmqconnect', () => {
  it('appends heartbeat query param when heartBeat > 0', async () => {
    const { svc, amqp } = makeSvcWith({ heartBeat: 30 })
    svc.setRoute('ex')
    await svc.start()
    expect(amqp.connect.mock.calls[0][0]).toBe(
      'amqp://guest:guest@localhost:5672?heartbeat=30'
    )
  })

  it('does not touch the url when heartBeat is 0', async () => {
    const { svc, amqp } = makeSvcWith()
    svc.setRoute('ex')
    await svc.start()
    expect(amqp.connect.mock.calls[0][0]).toBe(URL)
  })
})
