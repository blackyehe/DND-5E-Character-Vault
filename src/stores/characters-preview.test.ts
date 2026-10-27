import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { emptyCharacter, useCharactersStore, type Character } from './characters'
import { api } from '../lib/api'

vi.mock('../lib/api',()=>({api:{get:vi.fn(),patch:vi.fn(),post:vi.fn(),delete:vi.fn()}}))
const makeCharacter=()=>({...emptyCharacter(),_id:'0123456789abcdef01234567',updatedAt:'2026-10-19T00:00:00.000Z'})
beforeEach(()=>{setActivePinia(createPinia());vi.clearAllMocks()})

describe('player preview and progressive sheet opening',()=>{
  it('keeps the advancement snapshot version even after a newer sheet has refreshed',async()=>{
    const store=useCharactersStore(),character=makeCharacter(),frozen=character.updatedAt
    store.current={...character,updatedAt:'2026-10-19T00:01:00.000Z'}
    vi.mocked(api.patch).mockResolvedValue(store.current)
    await store.update(character._id,{meta:{...character.meta,level:2}},{expectedUpdatedAt:frozen,expectedLibraryRevision:'frozen-rules'})
    expect(api.patch).toHaveBeenCalledWith(`/api/characters/${character._id}`,expect.objectContaining({expectedUpdatedAt:frozen,expectedLibraryRevision:'frozen-rules'}))
  })
  it('tries player resource controls locally without a server write',async()=>{
    const store=useCharactersStore(),character=makeCharacter()
    store.current=character;store.roomContext={roomId:'room',role:'player',preview:true}
    await store.update(character._id,{combat:{...character.combat,hpCurrent:2}})
    expect(store.current?.combat.hpCurrent).toBe(2)
    expect(store.canEditPermanent).toBe(false)
    expect(api.patch).not.toHaveBeenCalled();expect(api.post).not.toHaveBeenCalled()
  })
  it('opens the quick snapshot and its spells without waiting for full rules',async()=>{
    const character=makeCharacter(),store=useCharactersStore()
    vi.mocked(api.get).mockResolvedValue({character,spells:{counterspell:{index:'counterspell',name:'Counterspell'}}})
    await store.fetchOne(character._id,{quick:true})
    expect(api.get).toHaveBeenCalledWith(`/api/characters/${character._id}?view=quick`,{timeoutMs:12000})
    expect(store.current?._id).toBe(character._id)
    expect(store.openingSpells.counterspell?.name).toBe('Counterspell')
    expect(store.loading).toBe(false)
  })
  it('coalesces duplicate reads for the current character',async()=>{
    const character=makeCharacter(),store=useCharactersStore()
    let finish!:(value:Character)=>void
    vi.mocked(api.get).mockImplementation(()=>new Promise(resolve=>{finish=resolve as typeof finish}))
    const first=store.fetchOne(character._id),second=store.fetchOne(character._id)
    expect(api.get).toHaveBeenCalledTimes(1)
    finish(character);await Promise.all([first,second])
    expect(store.current?._id).toBe(character._id)
  })
  it('preserves resolved rules on an unchanged quick refresh and detects pack revisions',async()=>{
    const character=makeCharacter(),store=useCharactersStore()
    store.current={...character,features:[{name:'Resolved racial grant',description:'From the last rule check.'}]}
    vi.mocked(api.get).mockResolvedValue({character,spells:{},libraryRevision:'new-pack-revision'})
    await store.fetchOne(character._id,{quick:true})
    expect(store.current?.features[0]?.name).toBe('Resolved racial grant')
    expect(store.libraryRevision).toBe('new-pack-revision')
  })
  it('does not overwrite a preview action with a late rule response',async()=>{
    const character=makeCharacter(),store=useCharactersStore()
    store.roomContext={roomId:'room',role:'player',preview:true};store.current=character
    const startedAt=store.mutation
    await store.update(character._id,{combat:{...character.combat,hpCurrent:2}})
    expect(store.acceptResolved(character,startedAt,'room:player:true')).toBe(false)
    expect(store.acceptResolved(character,store.mutation,'room:player:true')).toBe(false)
    expect(store.current?.combat.hpCurrent).toBe(2)
  })
  it('keeps an open editor and a newer saved version intact',()=>{
    const character=makeCharacter(),store=useCharactersStore();store.current=character;store.editing=true
    const changedRules={...structuredClone(character),features:[{name:'Updated class grant',description:'A newer published rule.'}]}
    expect(store.acceptResolved(changedRules,store.mutation,'owner:owner:false')).toBe(false)
    expect(store.rulesPending).toBe(true)
    const older=structuredClone(character)
    store.editing=false;store.current.updatedAt='2026-10-19T00:01:00.000Z'
    expect(store.acceptResolved(older,store.mutation,'owner:owner:false')).toBe(false)
  })
  it('removes the original import data from a player preview',async()=>{
    const character=makeCharacter(),store=useCharactersStore()
    character.externalImport={provider:'dmv',sourceUrl:'',source:'original choices',importedAt:character.updatedAt,warnings:[]}
    store.roomContext={roomId:'room',role:'player',preview:true}
    vi.mocked(api.get).mockResolvedValue({character,spells:{}})
    await store.fetchOne(character._id,{quick:true})
    expect(store.current?.externalImport).toBeUndefined()
  })
})
