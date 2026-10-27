import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express, { type NextFunction, type Request, type Response } from 'express'
import type { Server } from 'node:http'
import { emptyCharacter } from '../../shared/character'
import type { PartyMemberSnapshot } from '../../shared/party-dashboard'

const ids = vi.hoisted(() => ({ room: '1'.repeat(24), hero: '2'.repeat(24), extra: '3'.repeat(24), foreign: '4'.repeat(24), owner: 'a'.repeat(24), player: 'b'.repeat(24), outsider: 'c'.repeat(24) }))
const db = vi.hoisted(() => ({ documents: [] as (Record<string, unknown> & { _id: string; userId: string })[], find: vi.fn(), select: vi.fn() }))
vi.mock('../middleware/auth', () => ({ requireAuth: (req: Request, res: Response, next: NextFunction) => {
  req.userId = req.get('x-test-user')
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })
  next()
} }))
vi.mock('../models/Room', () => ({ Room: { findOne: async (query: { _id: string; $or: { ownerId?: string; members?: string }[] }) =>
  query._id === ids.room && query.$or.some(condition => condition.ownerId === ids.owner || condition.members === ids.player)
    ? { ownerId: ids.owner, members: [ids.player] } : null } }))
vi.mock('../models/Character', () => ({ Character: { find: db.find } }))
vi.mock('../lib/workshop-library', () => ({ workshopLibrary: vi.fn(), workshopRevision: vi.fn(), resolveWorkshopCharacter: vi.fn() }))
import router from './rooms'
import { workshopLibrary } from '../lib/workshop-library'

let server: Server, base: string
beforeAll(async () => {
  const app = express(); app.use('/rooms', router)
  await new Promise<void>((resolve, reject) => { server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()) })
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/rooms`
})
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
beforeEach(() => {
  vi.clearAllMocks()
  db.documents = [ids.hero, ids.extra, ids.foreign].map((id, i) => ({ ...emptyCharacter(), _id: id, userId: i === 2 ? ids.outsider : ids.owner, updatedAt: '2026-10-22T00:00:00.000Z' }))
  db.find.mockImplementation((query: { userId: string; _id: { $in: string[] } }) => ({ select: (projection: string) => {
    db.select(projection)
    return { lean: async () => db.documents.filter(c => c.userId === query.userId && query._id.$in.includes(c._id)) }
  } }))
})
const get = (characters = ids.hero, user: string | null = ids.owner, room = ids.room) => fetch(`${base}/${room}/party?characters=${characters}`, { headers: { connection: 'close', ...(user ? { 'x-test-user': user } : {}) } })

describe('DM party snapshot boundary', () => {
  it('requires authentication, room access, and DM ownership before reading characters', async () => {
    expect((await get(ids.hero, null)).status).toBe(401)
    expect((await get(ids.hero, ids.outsider)).status).toBe(404)
    expect((await get(ids.hero, ids.player)).status).toBe(403)
    expect((await get(ids.hero, ids.owner, 'invalid')).status).toBe(404)
    expect(db.find).not.toHaveBeenCalled()
  })
  it('returns only requested, currently owned snapshots without imports or pack reads', async () => {
    const response = await get(`${ids.hero},${ids.foreign}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json() as { members: PartyMemberSnapshot[] }
    expect(body.members).toHaveLength(1)
    expect(body.members[0]).toMatchObject({ id: ids.hero, hp: { current: 10, max: 10, temp: 0 }, ac: 10, perception: 10 })
    expect(body.members[0]).not.toHaveProperty('externalImport')
    expect(body.members[0]).not.toHaveProperty('personality')
    expect(db.find).toHaveBeenCalledWith({ userId: ids.owner, _id: { $in: [ids.hero, ids.foreign] } })
    expect(db.select).toHaveBeenCalledWith('-externalImport -personality')
    expect(workshopLibrary).not.toHaveBeenCalled()
  })
  it('rejects invalid and oversized batches before any character query', async () => {
    const oversized = Array.from({ length: 41 }, (_, i) => i.toString(16).padStart(24, '0')).join(',')
    for (const value of ['', 'bad', oversized]) expect((await get(value)).status).toBe(400)
    expect(db.find).not.toHaveBeenCalled()
  })
})
