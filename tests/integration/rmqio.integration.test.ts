const amqp: any = require('amqplib')

const BROKER_URL = process.env.RMQ_URL || 'amqp://guest:guest@localhost:5672'
const MGMT_URL = process.env.RMQ_MGMT_URL || 'http://localhost:15672'

const detect = (async () => {
  try {
    const conn = await amqp.connect(BROKER_URL)
    await conn.close()
    return true
  } catch {
    return false
  }
})()

const itBroker = (
  name: string,
  fn: () => Promise<void> | void,
  timeout: number = 60000
) =>
  it(name, async () => {
    if (!(await detect)) return
    await fn()
  }, timeout)

const suffix = () => Math.random().toString(36).slice(2, 8)

let svc: any
const queuesToDelete: string[] = []

function makeSvc(options: Record<string, unknown> = {}) {
  jest.isolateModules(() => {
    const mod: any = require('../../src/index')
    svc = mod.rmqio({ url: BROKER_URL, ...options })
  })
  return svc as any
}

function makePub(options: Record<string, unknown> = {}) {
  let pub: any
  jest.isolateModules(() => {
    const mod: any = require('../../src/index')
    pub = mod.rmqio({ url: BROKER_URL, ...options })
  })
  return pub as any
}

const settle = () => new Promise(r => setTimeout(r, 300))

async function mgmtFetch(path: string): Promise<any> {
  const res = await fetch(`${MGMT_URL}/api/${path}`, {
    headers: {
      Authorization: 'Basic ' + Buffer.from('guest:guest').toString('base64')
    }
  })
  return res.json()
}

// publish/receive readiness without sleep races: rmqconnect does not await
// its assertQueue/bindTo/consume setup
async function waitReady(queue: string, exchange: string, bindings: number) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const [exchangeBindings, queueInfo] = await Promise.all([
        mgmtFetch(`exchanges/%2F/${exchange}/bindings/source`),
        mgmtFetch(`queues/%2F/${queue}`)
      ])
      if (
        Array.isArray(exchangeBindings) &&
        exchangeBindings.length >= bindings &&
        queueInfo.consumers > 0
      ) {
        return
      }
    } catch {}
    await new Promise(r => setTimeout(r, 150))
  }
  throw new Error(`broker never became ready for ${exchange}/${queue}`)
}

afterAll(async () => {
  const conn = await amqp.connect(BROKER_URL)
  const ch = await conn.createChannel()
  for (const q of queuesToDelete) {
    await ch.deleteQueue(q)
  }
  await ch.close()
  await conn.close()
})

itBroker(
  'deliver and ack a JSON message end to end',
  async () => {
    const exchange = `it-ex-${suffix()}`
    const queue = `it-q-${suffix()}`
    queuesToDelete.push(queue)

    const instance = makeSvc()
    instance.setServiceName(queue).setRoute(exchange)
    const received = new Promise<any>(resolve => {
      instance.on('hello', async (msg: any, ack: () => Promise<void>) => {
        resolve(msg)
        await ack()
      })
    })

    await instance.start()
    await waitReady(queue, exchange, 1)
    await instance.publish({ content: { v: 1 } }, 'hello')
    await instance.waitConfirms()

    expect(await received).toEqual({ v: 1 })
    await settle()
    await instance.closeConn(() => {})
  },
  30000
)

itBroker(
  'nack with an error topic republishes to the error topic',
  async () => {
    const exchange = `it-ex-${suffix()}`
    const queue = `it-q-${suffix()}`
    queuesToDelete.push(queue)

    const instance = makeSvc()
    instance.setServiceName(queue).setRoute(exchange)
    const received = new Promise<void>(resolve => {
      instance.on(
        'boom',
        async (_msg: any, _ack: () => void, nack: (...a: any[]) => Promise<void>) => {
          await nack('error')
          resolve()
        }
      )
    })
    const errored = new Promise<any>(resolve => {
      instance.on('error', async (msg: any, ack: () => Promise<void>) => {
        resolve(msg)
        await ack()
      })
    })

    await instance.start()
    await waitReady(queue, exchange, 2)
    await instance.publish({ content: { oops: 'data' } }, 'boom')
    await received
    expect(await errored).toEqual({ oops: 'data' })
    await settle()
    await instance.closeConn(() => {})
  },
  30000
)

itBroker(
  'binarySerialization roundtrip via msgpack',
  async () => {
    const exchange = `it-ex-${suffix()}`
    const queue = `it-q-${suffix()}`
    queuesToDelete.push(queue)

    const instance = makeSvc({ binarySerialization: true })
    instance.setServiceName(queue).setRoute(exchange)
    const received = new Promise<any>(resolve => {
      instance.on('hello', async (msg: any, ack: () => Promise<void>) => {
        resolve(msg)
        await ack()
      })
    })

    await instance.start()
    await waitReady(queue, exchange, 1)
    await instance.publish({ content: { z: 9 } }, 'hello')
    expect(await received).toEqual({ z: 9 })
    await settle()
    await instance.closeConn(() => {})
  },
  30000
)

itBroker(
  'quorumQueuesEnabled asserts a quorum queue without throwing',
  async () => {
    const exchange = `it-ex-${suffix()}`
    const queue = `it-q-${suffix()}`
    queuesToDelete.push(queue)

    const instance = makeSvc({ quorumQueuesEnabled: true })
    instance.setServiceName(queue).setRoute(exchange)
    const received = new Promise<any>(resolve => {
      instance.on('hello', async (msg: any, ack: () => Promise<void>) => {
        resolve(msg)
        await ack()
      })
    })

    await instance.start()
    await waitReady(queue, exchange, 1)
    await instance.publish({ content: { quorum: true } }, 'hello')
    expect(await received).toEqual({ quorum: true })
    await settle()
    await instance.closeConn(() => {})
  },
  30000
)

itBroker(
  'publish-only service connects without a queue',
  async () => {
    const exchange = `it-ex-${suffix()}`

    const pub = makePub()
    pub.setRoute(exchange)
    await expect(pub.start()).resolves.not.toThrow()
    await pub.closeConn(() => {})
  },
  30000
)

itBroker(
  'closeConn runs the callback and emits stop hook',
  async () => {
    const exchange = `it-ex-${suffix()}`
    const queue = `it-q-${suffix()}`
    queuesToDelete.push(queue)

    const instance = makeSvc()
    instance.setServiceName(queue).setRoute(exchange)
    instance.on('hello', async () => {})

    const stopped = new Promise(resolve => {
      instance.addHook('stop', resolve)
    })

    await instance.start()
    await waitReady(queue, exchange, 1)
    const cb = jest.fn()
    await instance.closeConn(cb).catch(e => {
      throw new Error(`closeConn rejected: ${e && e.message}`)
    })
    expect(cb).toHaveBeenCalled()
    await stopped
  },
  30000
)
