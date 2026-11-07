import {beforeEach,describe,expect,it,vi} from 'vitest'
import {browseIndex,browseRecord,queryBrowseIndex,type BrowseQuery} from '../../shared/compendium-browse'
import {LOCAL_COMPENDIUM_VERSION,LOCAL_CATEGORY_BYTES,localIndexDigest,type LocalCompendiumSnapshot,type StoredCompendiumSnapshot} from '../../shared/local-compendium'
import {LocalCompendiumEngine,type LocalIndexStorage} from './local-compendium-engine'

const revision='a'.repeat(64),owner='owner',kind='spells'
const index=browseIndex(Array.from({length:80},(_,i)=>browseRecord({index:'spell-'+i,name:i%2?'Fire spell '+i:'Ice spell '+i,url:'',level:i%10,school:{index:'evocation'}},kind)),kind)
const query:BrowseQuery={query:'fire',page:2,facets:{level:'3'},items:{category:'',weapon:'',damage:'',armour:''}}
const snapshot=async():Promise<LocalCompendiumSnapshot>=>{const payload=JSON.stringify(index);return {version:LOCAL_COMPENDIUM_VERSION,owner,kind,revision,digest:await localIndexDigest(payload),payload}}
let saved:StoredCompendiumSnapshot|undefined,storage:LocalIndexStorage
beforeEach(()=>{saved=undefined;storage={read:vi.fn(async()=>saved),write:vi.fn(async value=>{saved=structuredClone(value)})}})
describe('bounded device catalogue',()=>{
 it('revalidates identical category bytes under a new library revision without resetting their age',async()=>{
  const engine=new LocalCompendiumEngine(storage),value=await snapshot(),next='b'.repeat(64)
  await engine.save(value,owner,kind)
  const savedAt=saved!.savedAt
  saved!.bytes=-1
  expect(await engine.identity(owner,kind)).toEqual({revision,digest:value.digest})
  expect(await engine.revalidate(owner,kind,revision,value.digest,next)).toBe(next)
  expect(saved).toMatchObject({revision:next,savedAt,payload:value.payload,digest:value.digest,bytes:new TextEncoder().encode(value.payload).length})
  const reloaded=new LocalCompendiumEngine(storage)
  await reloaded.open(owner,kind)
  expect(reloaded.query(owner,kind,next,query)).toEqual(queryBrowseIndex(index,kind,query,next))
 })
 it('never relabels changed, expired, corrupt or differently owned bytes',async()=>{
  const value=await snapshot(),original={...value,bytes:value.payload.length,savedAt:Date.now()}
  for(const changes of [{revision:'c'.repeat(64)},{digest:'d'.repeat(64)},{owner:'stranger'},{payload:value.payload+' '},{savedAt:Date.now()-8*86400000}]){
   saved={...original,...changes};vi.mocked(storage.write).mockClear()
   await new LocalCompendiumEngine(storage).revalidate(owner,kind,revision,value.digest,'b'.repeat(64)).catch(()=>null)
   expect(storage.write).not.toHaveBeenCalled()
  }
 })
 it('saves, reopens and returns exactly the server query result',async()=>{
  const engine=new LocalCompendiumEngine(storage)
  await engine.save(await snapshot(),owner,kind)
  const reopened=new LocalCompendiumEngine(storage)
  expect(await reopened.open(owner,kind)).toBe(revision)
  expect(reopened.query(owner,kind,revision,query)).toEqual(queryBrowseIndex(index,kind,query,revision))
 })
 it('requires exact account, category and authoritative revision identity before querying',async()=>{
  const engine=new LocalCompendiumEngine(storage)
  await engine.save(await snapshot(),owner,kind)
  expect(()=>engine.query('stranger',kind,revision,query)).toThrow()
  expect(()=>engine.query(owner,'monsters',revision,query)).toThrow()
  expect(()=>engine.query(owner,kind,'b'.repeat(64),query)).toThrow()
  expect(await new LocalCompendiumEngine(storage).open('stranger',kind)).toBeNull()
 })
 it.each(['checksum','version','structure','size'])('rejects invalid %s before admitting or writing the category',async(failure)=>{
  const value=await snapshot()
  if(failure==='checksum')value.payload+=' '
  if(failure==='version')(value as any).version='old-version'
  if(failure==='structure'){value.payload=JSON.stringify({...index,records:[{entry:{},search:'',facts:{}}]});value.digest=await localIndexDigest(value.payload)}
  if(failure==='size')value.payload=' '.repeat(LOCAL_CATEGORY_BYTES+1)
  await expect(new LocalCompendiumEngine(storage).save(value,owner,kind)).rejects.toThrow()
  expect(storage.write).not.toHaveBeenCalled()
 })
 it('ignores expired or implausibly future disk copies',async()=>{
  const value=await snapshot()
  for(const savedAt of [Date.now()-8*86400000,Date.now()+86400000]){
   saved={...value,bytes:value.payload.length,savedAt}
   expect(await new LocalCompendiumEngine(storage).open(owner,kind)).toBeNull()
  }
 })
 it('treats corrupt persisted payloads as missing so automatic preparation can repair them',async()=>{
  const value=await snapshot();saved={...value,payload:value.payload+' ',bytes:value.payload.length+1,savedAt:Date.now()}
  const engine=new LocalCompendiumEngine(storage)
  expect(await engine.open(owner,kind)).toBeNull()
  expect(()=>engine.query(owner,kind,revision,query)).toThrow()
 })
 it('does not retain an earlier category after a failed open or quota failure',async()=>{
  const engine=new LocalCompendiumEngine(storage)
  await engine.save(await snapshot(),owner,kind)
  vi.mocked(storage.read).mockRejectedValueOnce(Error('Blocked storage'))
  await expect(engine.open(owner,'monsters')).rejects.toThrow('Blocked storage')
  expect(()=>engine.query(owner,kind,revision,query)).toThrow()
  vi.mocked(storage.write).mockRejectedValueOnce(Error('Quota'))
  await expect(engine.save(await snapshot(),owner,kind)).rejects.toThrow('Quota')
  expect(()=>engine.query(owner,kind,revision,query)).toThrow()
 })
})
