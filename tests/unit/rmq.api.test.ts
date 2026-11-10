import { rmqio } from '../../src/index'
import { MsgBadFormat } from '../../src/rmqError'

const URL = 'amqp://guest:guest@localhost:5672'

jest.mock('amqplib', () => require('./amqpFake').default)

function makeSvc() {
  let svc: any
  jest.isolateModules(() => {
    const mod = require('../../src/index') as any
    svc = mod.rmqio({ url: URL })
  })
  return svc as any
}

function fresh() {
  let svc: any
  jest.isolateModules(() => {
    const mod: any = require('../../src/index')
    svc = mod
  })
  return svc as any
}

describe('RMQ service configuration', () => {
  it('setServiceName and setRoute chain and assign', () => {
    const svc = makeSvc()
    const ret = svc.setServiceName('q1').setRoute('ex1')
    expect(ret).toBe(svc)
    expect(svc.queue).toBe('q1')
    expect(svc.exchange).toBe('ex1')
  })

  it('start throws when neither queue nor exchange is set', () => {
    const svc = makeSvc()
    expect(() => svc.start()).toThrow(
      'An exchange defined is mandatory for this library'
    )
  })

  it('start does not throw with only an exchange (pub type)', () => {
    const svc = makeSvc().setRoute('ex2')
    expect(() => svc.start()).not.toThrow()
  })
})

describe('subscriptions', () => {
  it('on() registers a topic subscription', () => {
    const svc = makeSvc()
    svc.on('topic.one', () => {})
    expect(svc.subscriptions).toContain('topic.one')
  })

  it('on() with internalMsg registers internal subscription only', () => {
    const svc = makeSvc()
    svc.on('int.topic', () => {}, true)
    expect(svc.internalSubscriptions).toContain('int.topic')
    expect(svc.subscriptions).not.toContain('int.topic')
  })

  it('on() twice with the same topic throws', () => {
    const svc = makeSvc()
    svc.on('dup.topic', () => {})
    expect(() => svc.on('dup.topic', () => {})).toThrow(
      "You're already subscribed to dup.topic"
    )
  })

  it('hook listeners do not create subscriptions', () => {
    const svc = makeSvc()
    svc.addHook('start', () => {})
    expect(svc.subscriptions.length).toBe(0)
    expect(svc.internalSubscriptions.length).toBe(0)
  })
})

describe('hooks', () => {
  it('addHook throws for an unknown hook name', () => {
    const svc = makeSvc()
    expect(() => svc.addHook('nope', () => {})).toThrow('Hook not found')
  })

  it('accepts every valid hook name', () => {
    const svc = makeSvc()
    ;['publish', 'consume', 'prePublish', 'preConsume', 'start', 'stop'].forEach(
      h => expect(() => svc.addHook(h, () => {})).not.toThrow()
    )
  })

  it('start hook receives queue and exchange on start()', () => {
    const svc = makeSvc()
    svc.setRoute('hook-ex')
    const hook = jest.fn()
    svc.addHook('start', hook)
    expect(() => svc.start()).not.toThrow()
    expect(hook).toHaveBeenCalledWith({
      queue: undefined,
      exchange: 'hook-ex'
    })
  })
})

describe('emitInternal', () => {
  it('delivers payload to internal listener without broker', async () => {
    const svc = makeSvc()
    const got = new Promise(resolve => {
      svc.on('emit.test', (msg, _ack, _nack) => resolve(msg), true)
    })
    svc.emitInternal('emit.test', { data: 'x' })
    expect(await got).toEqual({ data: 'x' })
  })
})

describe('parseMsg', () => {
  const parseMsg: any = require('../../src/rmqOperations').parseMsg

  it('parses JSON content', () => {
    expect(parseMsg({ content: Buffer.from('{"a":1}') }, false)).toEqual({
      a: 1
    })
  })

  it('parses msgpack binary content', async () => {
    const { encode } = await import('@msgpack/msgpack')
    const encoded = encode({ b: 2 })
    expect(
      parseMsg({ content: Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength) } as any, true)
    ).toEqual({ b: 2 })
  })

  it('throws MsgBadFormat for numbers', () => {
    expect(() => parseMsg({ content: '42' as any }, false)).toThrow(
      MsgBadFormat
    )
  })

  it('throws MsgBadFormat for arrays', () => {
    expect(() => parseMsg({ content: '[1,2]' as any }, false)).toThrow(
      MsgBadFormat
    )
  })
})
