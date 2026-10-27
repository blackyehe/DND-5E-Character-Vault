import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express, { type NextFunction, type Request, type Response } from 'express'
import type { Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { sourceHash } from '../lib/orcbrew'
import { storedPackData,packSource } from '../lib/pack-storage'
import { gzipSync } from 'node:zlib'

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
      createIndexes: vi.fn(async () => {}),
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
          else if(key==='sourceHash')doc.sourceHash=value as string
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
vi.mock('../lib/pack-source',async()=>{
  const {decodedPackData}=await import('../lib/pack-storage')
  return {readPackDocuments:async(userId:string,packId?:string)=>database.docs.filter(d=>d.userId===userId&&d.type==='orcbrew'&&(!packId||d._id===packId)).map(d=>{try{return {...d,data:decodedPackData(d.data)}}catch{return d}})}
})
vi.mock('../lib/workshop-library',async()=>{
  const {buildOrcbrewCatalog}=await import('../lib/orcbrew'),{parsedPack}=await import('../lib/orcbrew-library')
  return {workshopLibrary:async(userId:string)=>{
    const packs=database.docs.filter(d=>d.userId===userId&&d.type==='orcbrew').flatMap(d=>{try{return [{id:d._id,filename:String(d.data.filename),includeDisabled:d.data.includeDisabled===true,parsed:parsedPack(d.data)}]}catch{return []}})
    return {catalog:buildOrcbrewCatalog(packs)}
  }}
})
vi.mock('../lib/monster-enrichment',()=>({enrichedMonsterEntries:async(_user:unknown,entries:unknown)=>entries}))
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
  it('imports despite a rejected automatic model initialization after the database recovers', async () => {
    database.model.init.mockRejectedValueOnce(Object.assign(new Error('Initial queue timeout'), {name: 'MongoWaitQueueTimeoutError'}))
    await expect(database.model.init()).rejects.toMatchObject({name: 'MongoWaitQueueTimeoutError'})
    const response = await upload(source())
    expect(response.status).toBe(201)
    expect(database.model.createIndexes).toHaveBeenCalled()
  })
  it('exports all owned packs as one reimportable file without mutating the library',async()=>{
    await upload(source('First rule'),'first.orcbrew')
    const second=source('Second rule')
    const compressed={filename:'second.orcbrew',source:gzipSync(Buffer.from(second)).toString('base64'),sourceEncoding:'gzip-base64',sourceBytes:Buffer.byteLength(second)}
    await request('/orcbrew-packs','POST',compressed)
    await upload(source('Other owner secret'),'other.orcbrew','other')
    const before=JSON.stringify(database.docs)
    const response=await request('/orcbrew-packs/export-all')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('All homebrew.orcbrew')
    const body=await response.text()
    expect(body).toContain('First rule');expect(body).toContain('Second rule');expect(body).not.toContain('Other owner secret')
    const imported=await upload(body,'All homebrew.orcbrew','recipient')
    expect(imported.status).toBe(201)
    const original=JSON.parse(before) as Doc[]
    expect(JSON.stringify(database.docs.filter(d=>d.userId!=='recipient'))).toBe(before)
    const {inspectOrcbrew}=await import('../lib/orcbrew')
    const expected=original.filter(d=>d.userId==='first-user').flatMap(d=>inspectOrcbrew(packSource(d.data)).entries.spells.map(e=>e.index))
    const actual=inspectOrcbrew(body).entries.spells.map(e=>e.index)
    expect(new Set(actual)).toEqual(new Set(expected))
    expect((await request('/orcbrew-packs/export-all','GET',undefined,'empty')).status).toBe(404)
    expect((await request('/orcbrew-packs/export-all','GET',undefined,'')).status).toBe(401)
  })
  it.runIf(Boolean(process.env.ORCBREW_EXPORT_FIXTURE))('round-trips a full portable library through HTTP import and combined export',async()=>{
    const text=readFileSync(process.env.ORCBREW_EXPORT_FIXTURE!,'utf8')
    const uploaded=await request('/orcbrew-packs','POST',storedPackData({filename:'All homebrew.orcbrew',source:text}))
    expect(uploaded.status).toBe(201)
    const response=await request('/orcbrew-packs/export-all')
    expect(response.status).toBe(200)
    const exported=await response.text()
    const {inspectOrcbrew,canonicalContent}=await import('../lib/orcbrew')
    const expected=inspectOrcbrew(text),actual=inspectOrcbrew(exported)
    for(const kind of Object.keys(expected.entries) as (keyof typeof expected.entries)[]){
      const signature=(entry:(typeof expected.entries)[typeof kind][number])=>`${entry.index}|${entry.disabled}|${canonicalContent(entry.details)}`
      expect(actual.entries[kind].map(signature).sort()).toEqual(expected.entries[kind].map(signature).sort())
    }
    const imported=await request('/orcbrew-packs','POST',storedPackData({filename:'All homebrew.orcbrew',source:exported}),'recipient')
    expect(imported.status).toBe(201)
  },120000)
  it('serves compact item filters and owner-scoped item rules and artwork',async()=>{
    const {writeEdn}=await import('../lib/workshop-pack')
    await upload(writeEdn({':orcpub.dnd.e5/magic-items':{':example':{':name':'Example Wand',':option-pack':'DMG',':codex/item':{item:{name:'Example Wand',source:'DMG',type:'WD',rarity:'rare',charges:7},description:'Seven charges and full rules.',mundane:false,hash:'example_dmg',sourceName:'Dungeon Master’s Guide',typeText:'wand',fluff:{images:[{href:{type:'external',url:'https://example.com/art.webp'}}]}}}}}))
    const response=await request('/homebrew/magic-items?view=index'),index=await response.json() as {itemDetailUrl:string}[]
    expect(response.status).toBe(200);expect(index).toHaveLength(1);expect(JSON.stringify(index)).not.toContain('Seven charges')
    const path=index[0]!.itemDetailUrl.replace('/api/content','')
    expect(await (await request(path)).text()).toContain('Seven charges')
    expect((await request(path,'GET',undefined,'other')).status).toBe(404)
    expect((await request('/homebrew/items/monsters/anything')).status).toBe(404)
  })
  it('serves a compact source-aware index and owner-scoped full monster details',async()=>{
    const monster='{:orcpub.dnd.e5/monsters {:fixture {:name "Fixture" :option-pack "MM" :type :aberration :size :large :challenge 5 :traits [{:name "Rule" :description "Full rule text"}]}}}'
    await upload(monster)
    const index=await (await request('/homebrew/monsters?view=index')).json() as {index:string;monsterDetailUrl:string}[]
    expect(index).toHaveLength(1);expect(JSON.stringify(index)).not.toContain('Full rule text')
    const path=index[0]!.monsterDetailUrl.replace('/api/content','')
    expect(await (await request(path)).text()).toContain('Full rule text')
    expect((await request(path,'GET',undefined,'other')).status).toBe(404)
  })
  it('replaces only the owned pack at the reviewed revision and exports exact source',async()=>{
    const original=source(),summary=await (await upload(original)).json() as Summary
    const next=source('Expanded')
    expect((await request(`/orcbrew-packs/${summary.id}/replace`,'POST',{pack:{filename:'example.orcbrew',source:next},expectedHash:sourceHash(original)},'other')).status).toBe(404)
    expect((await request(`/orcbrew-packs/${summary.id}/replace`,'POST',{pack:{filename:'example.orcbrew',source:next},expectedHash:'0'.repeat(64)})).status).toBe(409)
    const changed=await request(`/orcbrew-packs/${summary.id}/replace`,'POST',{pack:{filename:'example.orcbrew',source:next},expectedHash:sourceHash(original)})
    expect(changed.status).toBe(200);expect((await changed.json() as Summary).id).toBe(summary.id)
    expect(await (await request(`/orcbrew-packs/${summary.id}/export`)).text()).toBe(next)
    expect(database.docs).toHaveLength(1)
    expect((await request(`/orcbrew-packs/${summary.id}/replace`,'POST',{pack:{filename:'example.orcbrew',source:original},expectedHash:sourceHash(original)})).status).toBe(409)
  })
  it('accepts a compressed large pack and exports the original bytes',async()=>{
    const original=source('x'.repeat(8*1024*1024)),pack=storedPackData({filename:'large.orcbrew',source:original})
    const res=await request('/orcbrew-packs','POST',pack)
    expect(res.status).toBe(201)
    const summary=await res.json() as Summary
    expect(database.docs[0]!.data.sourceEncoding).toBe('gzip-base64')
    expect(await (await request(`/orcbrew-packs/${summary.id}/export`)).text()).toBe(original)
  })
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
