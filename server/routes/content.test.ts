import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express, { type NextFunction, type Request, type Response } from 'express'
import type { Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

interface Doc { _id: string; userId: string; type: string; sourceHash?: string; data: Record<string, unknown> }
interface Summary { id: string; filename: string; duplicate?: boolean; error?: string }
interface CatalogEntry { index: string; displayName: string; sourcePacks: string[]; aliases: string[] }
const database = vi.hoisted(() => {
  const docs: Doc[] = []
  let sequence = 0
  const matches = (doc: Doc, query: Record<string, unknown>) => Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && '$exists' in value) return (doc[key as keyof Doc] !== undefined) === value.$exists
    return doc[key as keyof Doc] === value
  })
  return {
    docs,
    model: {
      init: vi.fn(async () => {}),
      find: vi.fn((query: Record<string, unknown>) => ({ lean: async () => docs.filter((doc) => matches(doc, query)) })),
      findOne: vi.fn((query: Record<string, unknown>) => ({ lean: async () => docs.find((doc) => matches(doc, query)) ?? null })),
      create: vi.fn(async (value: Omit<Doc, '_id'>) => {
        if (value.sourceHash && docs.some((doc) => doc.sourceHash === value.sourceHash && doc.userId === value.userId && doc.type === value.type)) {
          throw Object.assign(new Error('Duplicate source'), { code: 11000 })
        }
        const doc = { ...value, _id: (++sequence).toString(16).padStart(24, '0') }
        docs.push(doc)
        return doc
      }),
      findOneAndUpdate: vi.fn((query: Record<string, unknown>, update: { $set: Record<string, unknown> }) => ({ lean: async () => {
        const doc = docs.find((item) => matches(item, query))
        if (!doc) return null
        for (const [key, value] of Object.entries(update.$set)) {
          if (key === 'data.includeDisabled') doc.data.includeDisabled = value
          else if (key === 'data') doc.data = value as Record<string, unknown>
        }
        return doc
      } })),
      deleteOne: vi.fn(async (query: Record<string, unknown>) => {
        const index = docs.findIndex((doc) => matches(doc, query))
        if (index < 0) return { deletedCount: 0 }
        docs.splice(index, 1)
        return { deletedCount: 1 }
      }),
    },
    updateCharacters: vi.fn(async () => ({ matchedCount: 0, modifiedCount: 0 })),
  }
})
vi.mock('../models/CustomContent', () => ({ CustomContent: database.model }))
vi.mock('../models/Character', () => ({ Character: { collection: { updateMany: database.updateCharacters } } }))
vi.mock('../middleware/auth', () => ({ requireAuth: (req: Request, res: Response, next: NextFunction) => {
  const user = req.get('x-test-user')
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.userId = user
  next()
} }))
import router from './content'

let server: Server
let base: string
const source = (description = 'A useful rule', extra = '') => `{:orcpub.dnd.e5/spells {:shared {:name "Shared" :key :shared :description "${description}" ${extra}}}}`
const request = async (path: string, method = 'GET', body?: unknown, user = 'first-user') => {
  try { return await fetch(`${base}/api/content${path}`, {
  method,
  headers: { 'content-type': 'application/json', connection: 'close', ...(user ? { 'x-test-user': user } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
  }) } catch (error) { throw new Error(`${method} ${path} failed`, { cause: error }) }
}
const upload = (text: string, filename = 'example.orcbrew', user = 'first-user') => request('/orcbrew-packs', 'POST', { filename, source: text }, user)

beforeAll(async () => {
  const app = express()
  app.use(express.json({ limit: '50mb' }))
  app.use('/api/content', router)
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not start test API')
  base = `http://127.0.0.1:${address.port}`
})
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
beforeEach(() => { database.docs.length = 0; database.updateCharacters.mockClear() })

describe('Orcbrew HTTP import and export', () => {
  it.runIf(Boolean(process.env.ORCBREW_FIXTURES))('round-trips supplied external files through the API and merges their overlap', async () => {
    const files = process.env.ORCBREW_FIXTURES!.split('|').map((path) => ({ filename: basename(path), bytes: readFileSync(path) }))
    for (const file of files) {
      const imported = await upload(file.bytes.toString('utf8'), file.filename)
      expect(imported.status).toBe(201)
      const summary = await imported.json() as Summary
      expect(JSON.stringify(summary).length).toBeLessThan(4000)
      const downloaded = await request(`/orcbrew-packs/${summary.id}/export`)
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(file.bytes)
      expect((await upload(file.bytes.toString('utf8'), file.filename)).status).toBe(200)
    }
    const kinds = ['spells', 'races', 'classes', 'backgrounds', 'feats', 'subclasses', 'subraces', 'monsters', 'languages', 'invocations', 'boons', 'selections']
    for (const kind of kinds) {
      const entries = await (await request(`/homebrew/${kind}`)).json() as CatalogEntry[]
      expect(entries.length).toBeGreaterThan(0)
      expect(new Set(entries.map((entry) => entry.index)).size).toBe(entries.length)
      expect(new Set(entries.map((entry) => entry.displayName)).size).toBe(entries.length)
    }
    expect(database.docs).toHaveLength(files.length)
    const combined = await (await request('/homebrew/spells')).json() as CatalogEntry[]
    if (files.length > 1) {
      const firstId = database.docs[0]!._id
      expect((await request(`/orcbrew-packs/${firstId}`, 'DELETE')).status).toBe(200)
      const remaining = await (await request('/homebrew/spells')).json() as CatalogEntry[]
      expect(remaining.map((item) => item.index)).toEqual(combined.map((item) => item.index))
    }
  }, 20000)

  it('makes repeat imports idempotent even under concurrent requests', async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => upload(source())))
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1)
    expect(responses.every((response) => [200, 201].includes(response.status))).toBe(true)
    expect(database.docs).toHaveLength(1)
    const duplicate = await (await upload(source(), 'renamed.orcbrew')).json() as Summary
    expect(duplicate.duplicate).toBe(true)
    const ownCopy = await upload(source(), 'example.orcbrew', 'second-user')
    expect(ownCopy.status).toBe(201)
  })

  it('merges semantic overlaps and keeps IDs stable after removing a duplicate file', async () => {
    const first = await (await upload(source(), 'first.orcbrew')).json() as Summary
    await upload(source('A useful rule', ':edit-event [:editor]'), 'second.orcbrew')
    const before = await (await request('/homebrew/spells')).json() as CatalogEntry[]
    expect(before).toHaveLength(1)
    expect(before[0].sourcePacks).toHaveLength(2)
    expect(before[0].aliases).toContain(`homebrew-${first.id}-shared`)
    expect((await request(`/orcbrew-packs/${first.id}`, 'DELETE')).status).toBe(200)
    expect(database.updateCharacters).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'first-user' }),
      expect.arrayContaining([expect.objectContaining({ $set: expect.objectContaining({ 'spellcasting.prepared': expect.any(Object) }) })]),
    )
    const after = await (await request('/homebrew/spells')).json() as CatalogEntry[]
    expect(after).toHaveLength(1)
    expect(after[0].index).toBe(before[0].index)
  })

  it('preserves changed definitions as distinct versions without replacing earlier files', async () => {
    await upload(source('Old rule'))
    await upload(source('New rule'))
    const entries = await (await request('/homebrew/spells')).json() as CatalogEntry[]
    expect(entries).toHaveLength(2)
    expect(new Set(entries.map((entry: { displayName: string }) => entry.displayName)).size).toBe(2)
    expect(database.docs).toHaveLength(2)
  })

  it('keeps large file summaries small and exports original UTF-8 bytes including BOM', async () => {
    const text = '\uFEFF' + source('Text\\n' + 'x'.repeat(1024 * 1024)) + '\r\n'
    const response = await upload(text)
    expect(response.status).toBe(201)
    const summary = await response.json() as Summary
    expect(JSON.stringify(summary).length).toBeLessThan(2500)
    expect(database.docs[0]!.data).not.toHaveProperty('entries')
    const listing = await (await request('/orcbrew-packs')).json() as Summary[]
    expect(JSON.stringify(listing).length).toBeLessThan(2500)
    expect(listing[0]).not.toHaveProperty('source')
    const exported = await request(`/orcbrew-packs/${summary.id}/export`)
    expect(Buffer.from(await exported.arrayBuffer())).toEqual(Buffer.from(text, 'utf8'))
  })

  it('preserves disabled definitions and allows the user to include them', async () => {
    const summary = await (await upload(source('Rule', ':disabled? true'))).json() as Summary
    expect(await (await request('/homebrew/spells')).json()).toHaveLength(0)
    const update = await request(`/orcbrew-packs/${summary.id}`, 'PATCH', { includeDisabled: true })
    expect(update.status).toBe(200)
    expect(await (await request('/homebrew/spells')).json()).toHaveLength(1)
  })

  it('scopes files, downloads, settings, and library entries to the signed-in user', async () => {
    const summary = await (await upload(source())).json() as Summary
    expect(await (await request('/homebrew/spells', 'GET', undefined, 'other')).json()).toHaveLength(0)
    expect((await request(`/orcbrew-packs/${summary.id}/export`, 'GET', undefined, 'other')).status).toBe(404)
    expect((await request(`/orcbrew-packs/${summary.id}`, 'PATCH', { includeDisabled: true }, 'other')).status).toBe(404)
    expect((await request(`/orcbrew-packs/${summary.id}`, 'DELETE', undefined, 'other')).status).toBe(404)
    expect((await request('/orcbrew-packs', 'GET', undefined, '')).status).toBe(401)
  })

  it('rejects corrupt files, oversized files, invalid extensions, and unvalidated source edits', async () => {
    expect((await upload('{bad]')).status).toBe(400)
    expect((await upload(source(), 'example.json')).status).toBe(400)
    expect((await upload(source('x'.repeat(8 * 1024 * 1024)))).status).toBe(400)
    expect(database.docs).toHaveLength(0)
    const summary = await (await upload(source())).json() as Summary
    expect((await request(`/orcbrew-packs/${summary.id}`, 'PUT', { source: '{}' })).status).toBe(405)
  })

  it('reports invalid legacy files without hiding valid files and reparses old saved sources', async () => {
    database.docs.push({ _id: 'a'.repeat(24), type: 'orcbrew', userId: 'first-user', data: { filename: 'old.orcbrew', source: source(), entries: {} } })
    database.docs.push({ _id: 'b'.repeat(24), type: 'orcbrew', userId: 'first-user', data: { filename: 'bad.orcbrew', source: '{broken' } })
    expect(await (await request('/homebrew/spells')).json()).toHaveLength(1)
    const summaries = await (await request('/orcbrew-packs')).json() as Summary[]
    expect(summaries.find((entry) => entry.filename === 'bad.orcbrew')?.error).toBeTruthy()
    expect((await (await upload(source())).json() as Summary).duplicate).toBe(true)
  })

  it('keeps the existing custom-content CRUD response contract', async () => {
    const response = await request('/spells', 'POST', { name: 'Custom Spell', level: 2 })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ name: 'Custom Spell', level: 2, id: expect.any(String) })
  })
})
