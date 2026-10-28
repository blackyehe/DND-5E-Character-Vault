import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {emptyCharacter} from '../../shared/character'
import {sheetReferenceCache,sheetReferenceCacheKey,type SheetReferences} from './sheet-reference-cache'
import {clearPersistedSheetReferences,persistSheetReferences,readPersistedSheetReferences,type SheetReferenceStorage,type StoredSheetReferences} from './persisted-sheet-references'

const scope={userId:'owner',path:'/api/characters/character/references',role:'owner',version:'v1',revision:'r1'}
const key=sheetReferenceCacheKey(scope)!
const refs=():SheetReferences=>({character:{...emptyCharacter(),_id:'character',updatedAt:'v1'},spells:[],feats:[],races:[],subclasses:[],classes:[],backgrounds:[]})
let saved:StoredSheetReferences|undefined,storage:SheetReferenceStorage
const read=()=>readPersistedSheetReferences(key,sheetReferenceCache.epoch,storage)
const persist=(value=refs(),cacheKey=key)=>persistSheetReferences(cacheKey,value,sheetReferenceCache.epoch,storage)
beforeEach(()=>{
 clearPersistedSheetReferences();saved=undefined
 storage={read:vi.fn(async k=>saved?.key===k?structuredClone(saved):undefined),write:vi.fn(async row=>{saved=structuredClone(row)}),clear:vi.fn(async()=>{saved=undefined})}
})
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()})
describe('authorized owner sheet persistence',()=>{
 it('does not reuse references from before the selected-rule projection changed',async()=>{
  const oldKey=JSON.stringify(JSON.parse(key).slice(0,5))
  await persist(refs(),oldKey);expect(storage.write).not.toHaveBeenCalled()
  expect(await readPersistedSheetReferences(oldKey,sheetReferenceCache.epoch,storage)).toBeUndefined();expect(storage.read).not.toHaveBeenCalled()
 })
 it('reuses bounded references across a new document memory epoch without the import source',async()=>{
  const value=refs();value.character!.externalImport={provider:'dmv',sourceUrl:'',source:'private original',importedAt:'',warnings:[]}
  await persist(value);expect(saved).toBeDefined();expect(saved!.payload).not.toContain('private original')
  sheetReferenceCache.clear()
  const result=await read();expect(result?.character?._id).toBe('character');expect(result?.character?.externalImport).toBeUndefined()
  result!.character!.combat.hpCurrent=1
  expect((await read())?.character?.combat.hpCurrent).toBe(10)
 })
 it.each([{userId:'other'},{version:'v2'},{revision:'r2'},{path:'/api/characters/other/references'},{path:'/api/rooms/room/characters/character/references',role:'dm'},{role:'player'}])('does not reuse another identity: %j',async change=>{
  await persist()
  expect(await readPersistedSheetReferences(sheetReferenceCacheKey({...scope,...change})!,sheetReferenceCache.epoch,storage)).toBeUndefined()
 })
 it('never persists room or player responses',async()=>{
  await persist(refs(),sheetReferenceCacheKey({...scope,path:'/api/rooms/room/characters/character/references',role:'dm'})!)
  await persist(refs(),sheetReferenceCacheKey({...scope,role:'player'})!)
  expect(storage.write).not.toHaveBeenCalled()
 })
 it('rejects expired, future-dated and corrupted values',async()=>{
  await persist();const original=structuredClone(saved!)
  for(const change of [{expires:0},{expires:Date.now()+2*86400000},{payload:'{}'},{digest:undefined},{owner:'other'},{key:'other'}]){
   saved={...original,...change} as StoredSheetReferences;expect(await read()).toBeUndefined()
  }
 })
 it('skips oversized or mismatched resolved sheets',async()=>{
  const huge=refs();huge.character!.personality.notes='x'.repeat(4*1024*1024)
  await persist(huge)
  const changed=refs();changed.character!.updatedAt='v2';await persist(changed)
  const broken=refs();broken.classes=[{index:'bad'} as any];await persist(broken)
  expect(storage.write).not.toHaveBeenCalled()
 })
 it('fails open to the server when storage throws or stalls',async()=>{
  vi.mocked(storage.read).mockRejectedValueOnce(Error('blocked'));expect(await read()).toBeUndefined()
  vi.useFakeTimers();vi.mocked(storage.read).mockImplementationOnce(()=>new Promise(()=>{}))
  const pending=read();await vi.advanceTimersByTimeAsync(101);expect(await pending).toBeUndefined()
 })
 it('rejects a disk response racing logout or forced refresh',async()=>{
  await persist();const original=saved!
  let finish!:(row:StoredSheetReferences)=>void
  vi.mocked(storage.read).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=read();clearPersistedSheetReferences();finish(original)
  expect(await pending).toBeUndefined()
 })
 it('rejects a hash/write begun before account invalidation',async()=>{
  let finish!:(hash:ArrayBuffer)=>void
  vi.spyOn(crypto.subtle,'digest').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=persist();expect(finish).toBeTypeOf('function');clearPersistedSheetReferences();finish(new ArrayBuffer(32));await pending
  expect(storage.write).not.toHaveBeenCalled()
 })
})
