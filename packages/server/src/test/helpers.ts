import { Hono } from 'hono'
import { vi } from 'vitest'
import type { AppVariables } from '../types.js'
import type { Db } from '../types.js'

function makeChain(resolveValue: unknown = []): any {
  const p = Promise.resolve(resolveValue)
  const c: any = {
    from: vi.fn(() => c),
    where: vi.fn(() => c),
    orderBy: vi.fn(() => c),
    limit: vi.fn(() => Promise.resolve(resolveValue)),
    leftJoin: vi.fn(() => c),
    onConflictDoNothing: vi.fn(() => Promise.resolve(undefined)),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  return c
}

export function createMockDb(countResult = 0): Db {
  return {
    select: vi.fn(() => makeChain([{ count: countResult }])),
    selectDistinct: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
    transaction: vi.fn().mockResolvedValue(undefined),
  } as unknown as Db
}

export function createTestApp(
  route: Hono<{ Variables: AppVariables }>,
  mountPath: string,
  mockDb: Db,
) {
  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', async (c, next) => {
    c.set('db', mockDb)
    c.set('userId', 'test-user-id')
    await next()
  })
  app.route(mountPath, route)
  return app
}

export async function req(
  app: Hono<any>,
  method: string,
  path: string,
  body?: object,
) {
  const url = `http://localhost${path}`
  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await app.request(url, init)
  const resBody = await res.json().catch(() => null)
  return {
    status: res.status,
    body: resBody,
    req: { path: path.split('?')[0], method: method.toUpperCase() },
    headers: Object.fromEntries(res.headers.entries()),
  }
}
