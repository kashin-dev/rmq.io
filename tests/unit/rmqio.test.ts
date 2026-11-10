import { rmqio } from '../../src/index'

let defaults: any = {}

jest.isolateModules(() => {
  const mod = require('../../src/index') as any
  const opt = { url: 'amqp://guest:guest@localhost:5672' }
  mod.rmqio(opt)
  defaults = opt
})

describe('rmqio factory', () => {
  it('fills in default options', () => {
    expect(defaults.reconnTime).toBe(5000)
    expect(defaults.preFetchingPolicy).toBe(10)
    expect(defaults.heartBeat).toBe(0)
    expect(defaults.log).toBe(false)
    expect(defaults.quorumQueuesEnabled).toBe(false)
    expect(defaults.binarySerialization).toBe(false)
  })

  it('keeps configured options over defaults', () => {
    const opt = {
      url: 'amqp://guest:guest@localhost:5672',
      reconnTime: 1000,
      preFetchingPolicy: 5,
      heartBeat: 30,
      log: true,
      quorumQueuesEnabled: true,
      binarySerialization: true
    } as any
    const inst = rmqio(opt)
    expect(opt.reconnTime).toBe(1000)
    expect(opt.preFetchingPolicy).toBe(5)
    expect(opt.heartBeat).toBe(30)
    expect(opt.log).toBe(true)
    expect(inst.heartBeat).toBe(30)
    expect(inst.prefetchPolicy).toBe(5)
  })

  it('is a singleton', () => {
    const a = rmqio({ url: 'amqp://guest:guest@localhost:5672' })
    const b = rmqio({ url: 'amqp://guest:guest@localhost:8080' })
    expect(b).toBe(a)
    expect(b['url']).toBe('amqp://guest:guest@localhost:5672')
  })
})
