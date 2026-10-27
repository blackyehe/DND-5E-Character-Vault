import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Server } from 'node:http'
import { emptyCharacter } from '../../shared/character'
import type { CharacterRuleLibrary } from '../lib/workshop-rules'
import { Character } from '../models/Character'
import { Room } from '../models/Room'
import { User } from '../models/User'
import { ExtensionPairing, ExtensionSession } from './models'
import type { expandedSheet } from './sheet'

const loaders = vi.hoisted(() => ({ focused: vi.fn(), full: vi.fn() }))
vi.mock('../lib/character-rule-library', () => ({ characterRuleLibrary: loaders.focused }))
vi.mock('../lib/workshop-library', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/workshop-library')>(),
  workshopLibrary: loaders.full,
}))
import { createExtensionApp } from './api'

const owner = 'a'.repeat(24), player = 'b'.repeat(24), characterId = 'c'.repeat(24)
const origin = 'http://localhost:5174'
let server: Server, base: string, details = true, assigned = true
const library: CharacterRuleLibrary = {
  catalog: { classes: [], subclasses: [], races: [], backgrounds: [], feats: [], spells: [{
    index: 'homebrew-spells-fixture', name: 'Fixture spell', contentKey: 'fixture', source: 'Fixture',
    disabled: false, legacyKey: 'fixture', aliases: ['old-fixture'], sourcePack: 'Fixture pack',
    desc: ['Complete imported spell prose'], level: 1, details: {},
  }] },
  rules: [], initial: {}, warnings: [],
}

describe('expanded reference library boundary', () => {
  beforeAll(async () => {
    vi.spyOn(ExtensionPairing, 'init').mockImplementation(async () => undefined as never)
    vi.spyOn(ExtensionSession, 'init').mockImplementation(async () => undefined as never)
    vi.spyOn(ExtensionSession, 'findOne').mockImplementation(() => ({ lean: async () => ({ userId: player, ownerId: owner, details }) }) as any)
    vi.spyOn(Room, 'findOne').mockImplementation(() => ({ lean: async () => ({ ownerId: owner, assignments: assigned ? [{ userId: player, characterId }] : [] }) }) as any)
    vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => ({ lean: async () => ({ _id: player, displayName: 'Fixture player' }) }) }) as any)
    vi.spyOn(Character, 'findOne').mockImplementation(() => ({ lean: async () => {
      const c = { ...emptyCharacter(), _id: characterId, updatedAt: '2026-10-27T00:00:00Z' }
      c.spellcasting.known = ['old-fixture', 'shield', 'missing-fixture']
      return c
    } }) as any)
    const app = await createExtensionApp({ websiteOrigin: 'http://localhost:5184', extensionOrigins: [origin] })
    server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/extension/v1/characters/${characterId}`
  })
  beforeEach(() => {
    details = true; assigned = true
    loaders.focused.mockReset().mockResolvedValue(library)
    loaders.full.mockReset().mockRejectedValue(Error('Expanded sheets must use the character rule reader'))
  })
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    vi.restoreAllMocks()
  })
  const request = (suffix = '/references') => fetch(base + suffix, { headers: { Origin: origin, Authorization: `Bearer ${'f'.repeat(43)}` } })

  it('uses the focused owner library for resolution and complete imported/SRD/missing references', async () => {
    const response = await request(), body = await response.json() as ReturnType<typeof expandedSheet>
    expect(response.status).toBe(200)
    expect(body.magic.spells.find((s: { id: string }) => s.id === 'old-fixture')).toMatchObject({ description: ['Complete imported spell prose'], available: true })
    expect(body.magic.spells.find((s: { id: string }) => s.id === 'shield')).toMatchObject({ available: true })
    expect(body.magic.spells.find((s: { id: string }) => s.id === 'missing-fixture')).toMatchObject({ available: false })
    expect(loaders.focused.mock.calls).toEqual([[owner], [owner]])
    expect(loaders.full).not.toHaveBeenCalled()
    expect(response.headers.get('server-timing')).toMatch(/^snapshot;dur=/)
  })
  it('checks expanded-detail approval before loading any library', async () => {
    details = false
    expect((await request()).status).toBe(403)
    expect(loaders.focused).not.toHaveBeenCalled()
    expect(loaders.full).not.toHaveBeenCalled()
  })
  it('checks character assignment before loading any library', async () => {
    assigned = false
    expect((await request()).status).toBe(404)
    expect(loaders.focused).not.toHaveBeenCalled()
    expect(loaders.full).not.toHaveBeenCalled()
  })
  it('keeps compact vitals on their existing single resolution path', async () => {
    details = false
    const response = await request('')
    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('magic')
    expect(loaders.focused.mock.calls).toEqual([[owner]])
    expect(loaders.full).not.toHaveBeenCalled()
  })
})
