import { describe, expect, it } from 'vitest'
import { applyLibraryAction as apply, emptyLibrary, folderTrail, type CharacterLibrary } from './character-library'
const fixture = (): CharacterLibrary => ({ revision: 7, folders: [{ id: 'campaign', name: 'Campaign', parentId: null }, { id: 'heroes', name: 'Main Characters', parentId: 'campaign' }, { id: 'npcs', name: 'NPCs', parentId: 'campaign' }], placements: [{ characterId: 'hero', folderId: 'heroes' }] })
describe('character library organisation', () => {
 it('keeps the default library empty without moving existing characters', () => expect(emptyLibrary()).toEqual({ revision: 0, folders: [], placements: [] }))
 it('builds campaign paths and permits equal names in different campaigns', () => {
  const state = apply(fixture(), { type: 'create', name: 'NPCs', parentId: null }, 'other')
  expect(folderTrail(state.folders, 'heroes').map(f => f.name)).toEqual(['Campaign', 'Main Characters'])
  expect(state.folders).toHaveLength(4)
 })
 it('rejects duplicate sibling names, including trimmed case variants', () => expect(() => apply(fixture(), { type: 'create', name: ' npcs ', parentId: 'campaign' }, 'other')).toThrow('already exists'))
 it('moves multiple characters without duplicates or mutating the prior snapshot', () => {
  const initial = fixture(), moved = apply(initial, { type: 'move', characterIds: ['hero', 'npc', 'hero'], folderId: 'npcs' })
  expect(moved.placements).toEqual([{ characterId: 'hero', folderId: 'npcs' }, { characterId: 'npc', folderId: 'npcs' }])
  expect(initial.placements[0]!.folderId).toBe('heroes'); expect(moved.revision).toBe(7)
 })
 it('unfiles characters and refuses a missing destination', () => {
  expect(apply(fixture(), { type: 'move', characterIds: ['hero'], folderId: null }).placements).toEqual([])
  expect(() => apply(fixture(), { type: 'move', characterIds: ['hero'], folderId: 'missing' })).toThrow('no longer exists')
 })
 it('rejects self moves and ancestor cycles', () => {
  expect(() => apply(fixture(), { type: 'reparent', folderId: 'heroes', parentId: 'heroes' })).toThrow('itself')
  expect(() => apply(fixture(), { type: 'reparent', folderId: 'campaign', parentId: 'heroes' })).toThrow('itself')
 })
 it('checks the whole moved subtree against the nesting limit', () => {
  let state = emptyLibrary()
  for (let i = 0; i < 6; i++) state = apply(state, { type: 'create', name: `Depth ${i}`, parentId: i ? `f${i - 1}` : null }, `f${i}`)
  expect(() => apply(state, { type: 'create', name: 'Too deep', parentId: 'f5' }, 'f6')).toThrow('six levels')
 })
 it('removes a leaf folder and moves its characters to the parent, keeping sheets', () => {
  const state = apply(fixture(), { type: 'remove', folderId: 'heroes' })
  expect(state.placements).toEqual([{ characterId: 'hero', folderId: 'campaign' }]); expect(state.folders.map(f => f.id)).not.toContain('heroes')
  expect(() => apply(fixture(), { type: 'remove', folderId: 'campaign' })).toThrow('subfolders')
 })
 it('unfiles characters when their top-level folder is removed', () => {
  expect(apply({ revision: 1, folders: [{ id: 'solo', name: 'Solo', parentId: null }], placements: [{ characterId: 'hero', folderId: 'solo' }] }, { type: 'remove', folderId: 'solo' }).placements).toEqual([])
 })
})
