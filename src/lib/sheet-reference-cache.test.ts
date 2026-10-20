import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyCharacter, type Character } from '../../shared/character'
import { sheetReferenceCache, sheetReferenceCacheKey, sheetReferenceInputs, type SheetReferences } from './sheet-reference-cache'

const character=():Character=>({...emptyCharacter(),_id:'character',updatedAt:'version-1'})
const refs=():SheetReferences=>({character:character(),spells:[],feats:[],races:[],subclasses:[],classes:[],backgrounds:[]})
const scope={userId:'owner',path:'/api/characters/character/references',role:'owner',version:'version-1',revision:'pack-1'}
beforeEach(()=>sheetReferenceCache.clear())
afterEach(()=>vi.restoreAllMocks())

describe('session reference cache boundaries',()=>{
  it('separates accounts, room paths, roles, saved versions and library revisions',()=>{
    const key=sheetReferenceCacheKey(scope)!
    sheetReferenceCache.write(key,refs(),sheetReferenceCache.epoch)
    expect(sheetReferenceCache.read(key)?.character?._id).toBe('character')
    for(const change of [{userId:'player'},{path:'/api/rooms/room/characters/character/references'},
      {role:'player'},{version:'version-2'},{revision:'pack-2'}]) {
      expect(sheetReferenceCache.read(sheetReferenceCacheKey({...scope,...change})!)).toBeUndefined()
    }
    expect(sheetReferenceCacheKey({...scope,userId:undefined})).toBeUndefined()
    expect(sheetReferenceCacheKey({...scope,revision:''})).toBeUndefined()
    expect(sheetReferenceCacheKey({...scope,preview:true})).toBeUndefined()
  })
  it('returns isolated copies and omits the original import document',()=>{
    const value=refs()
    value.character!.externalImport={provider:'dmv',sourceUrl:'',source:'raw choices',importedAt:'',warnings:[]}
    sheetReferenceCache.write('entry',value,sheetReferenceCache.epoch)
    const hit=sheetReferenceCache.read('entry')!
    expect(hit.character?.externalImport).toBeUndefined()
    hit.character!.combat.hpCurrent=1
    expect(sheetReferenceCache.read('entry')?.character?.combat.hpCurrent).toBe(10)
    expect(value.character!.externalImport.source).toBe('raw choices')
  })
  it('expires responses and rejects writes begun before logout or force refresh',()=>{
    const now=vi.spyOn(Date,'now').mockReturnValue(1000)
    const epoch=sheetReferenceCache.epoch
    sheetReferenceCache.write('entry',refs(),epoch)
    now.mockReturnValue(121001)
    expect(sheetReferenceCache.read('entry')).toBeUndefined()
    sheetReferenceCache.clear()
    sheetReferenceCache.write('late',refs(),epoch)
    expect(sheetReferenceCache.read('late')).toBeUndefined()
  })
  it('bounds entry count and skips oversized responses',()=>{
    for(let i=0;i<25;i++)sheetReferenceCache.write(String(i),refs(),sheetReferenceCache.epoch)
    expect(sheetReferenceCache.read('0')).toBeUndefined()
    expect(sheetReferenceCache.read('24')).toBeDefined()
    const huge=refs();huge.character!.personality.notes='x'.repeat(3*1024*1024)
    sheetReferenceCache.write('huge',huge,sheetReferenceCache.epoch)
    expect(sheetReferenceCache.read('huge')).toBeUndefined()
  })
})

describe('reference reload inputs',()=>{
  it('does not reload definitions for ordinary play counters',()=>{
    const c=character();c.resources=[{id:'points',name:'Points',max:6,used:0,recovery:'long'}]
    c.spellcasting.slots={l1:{max:4,used:0}}
    const before=sheetReferenceInputs(c)
    c.updatedAt='version-2';c.combat.hpCurrent=2;c.combat.hpTemp=4;c.combat.hitDiceUsed=1
    c.combat.deathSavesSuccess=1;c.combat.deathSavesFailure=1;c.combat.inspiration=true
    c.resources[0]!.used=3;c.spellcasting.slots.l1!.used=2
    expect(sheetReferenceInputs(c)).toBe(before)
  })
  it('refreshes definitions for rules, spells, inventory and choices',()=>{
    for(const change of [(c:Character)=>{c.meta.level=2},(c:Character)=>{c.features.push({name:'New feat',description:'Rules'})},
      (c:Character)=>{c.spellcasting.known.push('shield')},(c:Character)=>{c.equipment.push({name:'Ring',qty:1,weight:0,equipped:true,notes:''})},
      (c:Character)=>{c.abilities.int=16},(c:Character)=>{c.combat.hpMax=20},(c:Character)=>{c.spellcasting.slots.l1={max:4,used:0}}]) {
      const c=character(),before=sheetReferenceInputs(c);change(c)
      expect(sheetReferenceInputs(c)).not.toBe(before)
    }
  })
})
