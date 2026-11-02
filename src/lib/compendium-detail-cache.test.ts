import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {COMPENDIUM_DETAIL_VERSION,COMPENDIUM_PRELOAD_LIMITS,type CompendiumDetailResponse} from '../../shared/compendium-details'
import type {CompendiumDetailStorage,StoredCompendiumDetail} from './compendium-detail-storage'
const get=vi.hoisted(()=>vi.fn())
vi.mock('./api',()=>({api:{get}}))
const revision='a'.repeat(64),next='b'.repeat(64)
let rows:Map<string,StoredCompendiumDetail>,storage:CompendiumDetailStorage,events:Map<string,(event?:any)=>void>
let module:typeof import('./compendium-detail-cache')
const entry=(name='Original'):CompendiumDetailResponse=>({owner:'owner',kind:'spells',index:'one',version:COMPENDIUM_DETAIL_VERSION,revision,entry:{index:'one',name,url:'',desc:['Full entry values']}})
const load=()=>module.loadCompendiumDetail('owner','spells','one',storage)
const batch=(name='Original')=>({...entry(),entries:[{index:'one',entry:entry(name).entry}],skipped:[]})
const preload=(signal=new AbortController().signal)=>module.preloadCompendiumDetails('owner','spells',['one'],signal,512*1024,storage)
beforeEach(async()=>{
 vi.resetModules();get.mockReset();rows=new Map();events=new Map()
 const markers=new Map<string,string>()
 vi.stubGlobal('localStorage',{getItem:(key:string)=>markers.get(key)??null,setItem:(key:string,value:string)=>markers.set(key,value),removeItem:(key:string)=>markers.delete(key)})
 vi.stubGlobal('window',{addEventListener:(name:string,listener:(event:any)=>void)=>events.set(name,listener)})
 vi.stubGlobal('indexedDB',undefined)
 storage={read:vi.fn(async key=>rows.has(key)?structuredClone(rows.get(key)):undefined),write:vi.fn(async(key,value)=>{rows.set(key,structuredClone(value))}),clear:vi.fn(async()=>rows.clear())}
 get.mockImplementation(async(path:string)=>path.endsWith('/detail-revision')?{owner:'owner',kind:'spells',version:COMPENDIUM_DETAIL_VERSION,revision}:entry())
 module=await import('./compendium-detail-cache');module.adoptCompendiumDetails('owner')
})
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('persistent personal Compendium details',()=>{
 it('saves a verified preload batch and reuses it in a new session without opening it first',async()=>{
  storage.writeMany=vi.fn(async entries=>{for(const {key,row} of entries)rows.set(key,structuredClone(row))})
  get.mockResolvedValueOnce(batch());await preload();expect(storage.writeMany).toHaveBeenCalledOnce();expect(storage.write).not.toHaveBeenCalled()
  module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner');get.mockClear()
  expect((await load()).name).toBe('Original');expect(get.mock.calls.map(([path])=>path)).toEqual(['/api/compendium-browse/spells/detail-revision'])
 })
 it('does not make a click wait for a slow optional disk transaction',async()=>{
  let interrupted=false
  storage.writeMany=vi.fn((_entries,signal)=>new Promise(resolve=>{signal!.addEventListener('abort',()=>{interrupted=true;resolve(undefined)},{once:true})}))
  get.mockResolvedValueOnce(batch());const warming=preload()
  await warming // Network preparation finishes even while its disk save is pending.
  await vi.waitFor(()=>expect(storage.writeMany).toHaveBeenCalledOnce())
  expect((await load()).name).toBe('Original');await warming;expect(interrupted).toBe(true);expect(get).toHaveBeenCalledOnce()
 })
 it('keeps the memory fallback when optional batch storage is unavailable',async()=>{
  storage.writeMany=vi.fn(async()=>{throw Error('Quota')});get.mockResolvedValueOnce(batch());await preload()
  expect((await load()).name).toBe('Original');expect(get).toHaveBeenCalledOnce()
 })
 it('warms complete details without foreground work or disk writes; opening persists and reopening reuses them',async()=>{
  const {foregroundBusy}=await import('./foreground-work');get.mockResolvedValueOnce(batch())
  await preload();expect(foregroundBusy()).toBe(false);expect(storage.write).not.toHaveBeenCalled();expect(get.mock.calls[0]![1]).toMatchObject({background:true})
  expect((await load()).desc).toEqual(['Full entry values']);expect(get).toHaveBeenCalledOnce();await vi.waitFor(()=>expect(storage.write).toHaveBeenCalledOnce())
  module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner');expect((await load()).name).toBe('Original');expect(get.mock.calls.filter(([p])=>p.includes('/saved-detail/'))).toHaveLength(0)
 })
 it('revalidates an already saved entry without downloading its details again',async()=>{
  await load();module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner');get.mockClear();await preload()
  expect(get).toHaveBeenCalledOnce();expect(get.mock.calls[0]![0]).toContain('/detail-revision');expect(storage.write).toHaveBeenCalledOnce()
 })
 it('joins an almost-ready batch on click without a duplicate detail request',async()=>{
  let finish!:(value:unknown)=>void;get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const warming=preload();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));const opened=load();finish(batch());await warming;expect((await opened).name).toBe('Original');expect(get).toHaveBeenCalledOnce()
 })
 it('limits how long a click can wait for slow batch siblings and ignores their late values',async()=>{
  vi.useFakeTimers();let finish!:(value:unknown)=>void;get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const warming=preload(),outcome=warming.catch(()=>{});await vi.advanceTimersByTimeAsync(0);expect(finish).toBeTypeOf('function')
  const opened=load();await vi.advanceTimersByTimeAsync(COMPENDIUM_PRELOAD_LIMITS.joinMs);expect((await opened).name).toBe('Original');expect(get).toHaveBeenCalledTimes(2)
  finish(batch('Late old rules'));await outcome;expect((await load()).name).toBe('Original')
 })
 it.each(['owner','index','revision','oversized','duplicates'])('rejects invalid preloaded %s without populating disk or memory',async(mode)=>{
  storage.writeMany=vi.fn(async()=>{})
  const value:any=batch()
  if(mode==='owner')value.owner='stranger'
  if(mode==='index')value.entries[0].index='other'
  if(mode==='revision')value.revision='bad'
  if(mode==='oversized')value.entries[0].entry.desc=['x'.repeat(256*1024)]
  if(mode==='duplicates')value.entries.push(value.entries[0])
  get.mockResolvedValueOnce(value);await expect(preload()).rejects.toThrow();expect(storage.write).not.toHaveBeenCalled();expect(storage.writeMany).not.toHaveBeenCalled();expect((await load()).name).toBe('Original');expect(get.mock.calls.some(([p])=>p.includes('/saved-detail/'))).toBe(true)
 })
 it('aborts and discards a preload when the library or account changes',async()=>{
  let finish!:(value:unknown)=>void;get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));const warming=preload(),outcome=warming.catch(e=>e)
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));events.get('codex:library-changed')!();finish(batch());expect(await outcome).toBeInstanceOf(Error);expect(storage.write).not.toHaveBeenCalled()
 })
 it('does not let a delayed old batch overwrite a newer foreground authorization',async()=>{
  let finish!:(value:unknown)=>void;get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const warming=preload(),outcome=warming.catch(e=>e);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
  get.mockResolvedValueOnce({...entry('New rules'),index:'two',revision:next,entry:{...entry('New rules').entry,index:'two'}})
  expect((await module.loadCompendiumDetail('owner','spells','two',storage)).name).toBe('New rules')
  finish(batch('Old rules'));expect(await outcome).toMatchObject({message:expect.stringContaining('superseded')});expect(storage.write).toHaveBeenCalledOnce()
 })
 it('stores complete opened-entry values and reuses disk after a new same-account session',async()=>{
  expect((await load()).desc).toEqual(['Full entry values'])
  await vi.waitFor(()=>expect(storage.write).toHaveBeenCalledOnce())
  module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner');get.mockClear()
  expect((await load()).desc).toEqual(['Full entry values'])
  expect(get).toHaveBeenCalledOnce();expect(get.mock.calls[0]![0]).toMatch(/\/detail-revision$/)
  expect(storage.write).toHaveBeenCalledOnce()
 })
 it('reuses a recently authorized entry without another detail response and returns isolated values',async()=>{
  const first=await load();(first.desc as string[])[0]='Changed by caller'
  expect((await load()).desc).toEqual(['Full entry values']);expect(get).toHaveBeenCalledOnce()
 })
 it('fetches new values after the current revision changes',async()=>{
  await load();module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner')
  get.mockImplementation(async(path:string)=>path.endsWith('/detail-revision')?{...entry(),revision:next}:{...entry('Updated'),revision:next})
  expect((await load()).name).toBe('Updated')
  expect(get.mock.calls.filter(([path])=>path.includes('/saved-detail/'))).toHaveLength(2)
 })
 it('rejects removed entries instead of falling back to saved values',async()=>{
  await load();module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner')
  get.mockImplementation(async(path:string)=>{if(path.endsWith('/detail-revision'))return {...entry(),revision:next};throw Error('No longer available')})
  await expect(load()).rejects.toThrow('No longer available')
 })
 it.each(['owner','kind','version','payload','digest','expired','future'])('repairs invalid stored %s through the authenticated detail endpoint',async(mode)=>{
  await load();module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner')
  const row=[...rows.values()][0]!
  if(mode==='owner')row.owner='stranger'
  if(mode==='kind')row.kind='monsters'
  if(mode==='version')(row as any).version='old'
  if(mode==='payload')row.payload+=' '
  if(mode==='digest')row.digest='wrong'
  if(mode==='expired')row.savedAt=Date.now()-8*86400000
  if(mode==='future')row.savedAt=Date.now()+86400000
  expect((await load()).name).toBe('Original')
  expect(get.mock.calls.filter(([path])=>path.includes('/saved-detail/'))).toHaveLength(2)
 })
 it.each(['owner','kind','version','index'])('rejects mismatched %s in an authenticated detail response',async(mode)=>{
  const response=entry();(response as any)[mode]='wrong';get.mockResolvedValue(response)
  await expect(load()).rejects.toThrow('entry changed');expect(storage.write).not.toHaveBeenCalled()
 })
 it('does not return disk values when authenticated validation is unavailable',async()=>{
  await load();module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner');get.mockRejectedValue(Error('Sign in'))
  await expect(load()).rejects.toThrow('Sign in')
 })
 it('invalidates recent detail authorization immediately on a local library mutation',async()=>{
  await load();events.get('codex:library-changed')!()
  get.mockImplementation(async(path:string)=>path.endsWith('/detail-revision')?{...entry(),revision:next}:{...entry('Updated'),revision:next})
  expect((await load()).name).toBe('Updated')
 })
 it('bounds storage delays and still returns a live entry when storage is blocked',async()=>{
  vi.useFakeTimers();vi.mocked(storage.read).mockImplementationOnce(()=>new Promise(()=>{}))
  const pending=load();await vi.advanceTimersByTimeAsync(100)
  expect((await pending).name).toBe('Original')
  module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner')
  vi.mocked(storage.read).mockRejectedValue(Error('Blocked'));vi.mocked(storage.write).mockRejectedValue(Error('Quota'))
  expect((await load()).name).toBe('Original')
 })
 it('returns oversized or unhashable live values without persisting them',async()=>{
  const huge=entry();huge.entry.desc=['x'.repeat(1024*1024)];get.mockResolvedValueOnce(huge)
  expect((await load()).desc).toEqual(huge.entry.desc);expect(storage.write).not.toHaveBeenCalled()
  vi.spyOn(crypto.subtle,'digest').mockRejectedValue(Error('Unavailable'))
  expect((await load()).name).toBe('Original');expect(storage.write).not.toHaveBeenCalled()
 })
 it('rejects a late response after logout or account switching',async()=>{
  let finish!:(v:unknown)=>void;get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=load();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
  module.clearCompendiumDetails();module.adoptCompendiumDetails('stranger');finish(entry())
  await expect(pending).rejects.toThrow('account changed');expect(storage.write).not.toHaveBeenCalled()
 })
 it('does not persist a checksum completed after logout',async()=>{
  let finish!:(hash:ArrayBuffer)=>void
  vi.spyOn(crypto.subtle,'digest').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=load();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
  module.clearCompendiumDetails();finish(new ArrayBuffer(32))
  await expect(pending).rejects.toThrow('account changed');expect(storage.write).not.toHaveBeenCalled()
 })
 it('rejects a detail validation that finishes after cross-tab account changes',async()=>{
  await load();module.suspendCompendiumDetails();module.adoptCompendiumDetails('owner')
  let finish!:(v:unknown)=>void;get.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=load();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
  events.get('storage')!({key:'codex:compendium-detail-owner',newValue:'stranger'});finish(entry())
  await expect(pending).rejects.toThrow('account changed')
 })
})
