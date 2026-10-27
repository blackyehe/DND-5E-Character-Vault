import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkshopLibrary } from './workshop-library'

const state = vi.hoisted(() => ({
  revisions: new Map<string, number>(),
  reads: vi.fn(),
  rejectRead: false,
}))
vi.mock('../models/CustomContent', () => ({ CustomContent: { find: (filter: { userId: string }) => {
  const query = {
    select: () => query,
    sort: () => query,
    lean: async () => [{ _id: filter.userId, updatedAt: state.revisions.get(filter.userId) ?? 1 }],
  }
  return query
} } }))
vi.mock('../models/Character', () => ({ Character: {} }))
vi.mock('./pack-source', () => ({ readPackDocuments: async (owner: string) => {
  state.reads(owner)
  if (state.rejectRead) throw Error('Source unavailable')
  const revision = state.revisions.get(owner) ?? 1
  return [{
    _id: owner, updatedAt: new Date(revision), sourceHash: `${owner}-${revision}`,
    data: { filename: `${owner}.orcbrew`, source: `{:orcpub.dnd.e5/spells {:spell {:name "${owner} revision ${revision}" :level 1}}}` },
  }]
} }))

beforeEach(() => {
  vi.resetModules()
  state.revisions.clear()
  state.reads.mockClear()
  state.rejectRead = false
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function fill() {
  const library = await import('./workshop-library')
  const values = new Map<string, WorkshopLibrary>()
  for (const owner of ['A', 'B', 'C', 'D']) values.set(owner, await library.workshopLibrary(owner))
  return { ...library, values }
}

describe('full Workshop library cache', () => {
  it('rebuilds changed data without evicting an unrelated warm owner at capacity', async () => {
    const { workshopLibrary, values } = await fill()
    state.revisions.set('C', 2)
    const changed = await workshopLibrary('C')
    expect(changed).not.toBe(values.get('C'))
    expect(changed.catalog.spells.map(entry => entry.name)).toEqual(['C revision 2'])
    expect(await workshopLibrary('A')).toBe(values.get('A'))
    expect(state.reads.mock.calls.map(([owner]) => owner)).toEqual(['A', 'B', 'C', 'D', 'C'])
  })

  it('makes a rebuilt owner recent while retaining the four-owner limit', async () => {
    const { workshopLibrary, values } = await fill()
    state.revisions.set('C', 2)
    const changed = await workshopLibrary('C')
    await workshopLibrary('E')
    await workshopLibrary('F')
    await workshopLibrary('G')
    expect(await workshopLibrary('C')).toBe(changed)
    expect((await workshopLibrary('E')).catalog.spells[0]?.name).toBe('E revision 1')
    expect(await workshopLibrary('A')).not.toBe(values.get('A'))
    expect(state.reads.mock.calls.map(([owner]) => owner)).toEqual(['A', 'B', 'C', 'D', 'C', 'E', 'F', 'G', 'A'])
  })

  it('refreshes recency on a warm read and isolates owners', async () => {
    const { workshopLibrary, values } = await fill()
    expect(await workshopLibrary('A')).toBe(values.get('A'))
    await workshopLibrary('E')
    expect(await workshopLibrary('A')).toBe(values.get('A'))
    expect(await workshopLibrary('B')).not.toBe(values.get('B'))
    expect(values.get('A')!.catalog.spells[0]?.name).toBe('A revision 1')
    expect(values.get('B')!.catalog.spells[0]?.name).toBe('B revision 1')
  })

  it('coalesces concurrent loads and retries after a failed revision rebuild', async () => {
    const { workshopLibrary, values } = await fill()
    state.revisions.set('C', 2)
    state.rejectRead = true
    await expect(workshopLibrary('C')).rejects.toThrow('Source unavailable')
    expect(await workshopLibrary('A')).toBe(values.get('A'))
    state.rejectRead = false
    const [one, two] = await Promise.all([workshopLibrary('C'), workshopLibrary('C')])
    expect(one).toBe(two)
    expect(one.catalog.spells[0]?.name).toBe('C revision 2')
    expect(state.reads.mock.calls.filter(([owner]) => owner === 'C')).toHaveLength(3)
  })
})
