import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const get=vi.hoisted(()=>vi.fn())
vi.mock('./api',()=>({api:{get}}))
const revision='a'.repeat(64),query={query:'',page:1,facets:{},items:{category:'',weapon:'',damage:'',armour:''}}
let marker:string|null,created:number,terminated:number,commands:string[],storageChanged:((event:{key:string|null})=>void)|undefined
class TestWorker {
 onmessage?: (event:{data:unknown})=>void
 onerror?:()=>void
 constructor(){created++}
 postMessage(command:any){commands.push(command.action);queueMicrotask(()=>this.onmessage?.({data:{id:command.id,value:command.action==='open'||command.action==='save'?revision:{revision,entries:[]}}}))}
 terminate(){terminated++}
}
beforeEach(()=>{
 vi.resetModules();get.mockReset();created=0;terminated=0;commands=[];marker=JSON.stringify({owner:'owner',kinds:['spells']})
 vi.stubGlobal('Worker',TestWorker)
 vi.stubGlobal('localStorage',{getItem:()=>marker,setItem:(_k:string,v:string)=>{marker=v},removeItem:()=>{marker=null}})
 vi.stubGlobal('indexedDB',{deleteDatabase:vi.fn(()=>({}))})
 vi.stubGlobal('window',{addEventListener:(_name:string,listener:typeof storageChanged)=>{storageChanged=listener}})
})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
describe('device index validation boundary',()=>{
 it('changes the cross-tab marker on every successful resave of the same category',async()=>{
  vi.useFakeTimers()
  const module=await import('./local-compendium-client')
  get.mockImplementation(async(path:string)=>path.endsWith('/local-index')?{owner:'owner',kind:'spells',revision}:{owner:'owner',revision,version:'local-compendium-1'})
  await module.saveLocalCompendium('owner','spells',new AbortController().signal)
  const first=marker
  await module.saveLocalCompendium('owner','spells',new AbortController().signal)
  expect(marker).not.toBe(first);expect(JSON.parse(marker!).kinds).toEqual(['spells']);module.releaseLocalCompendium()
 })
 it('reports an outdated category and stops revalidating it until an explicit successful refresh',async()=>{
  const module=await import('./local-compendium-client')
  get.mockResolvedValueOnce({owner:'owner',revision:'b'.repeat(64),version:'local-compendium-1'})
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toBeUndefined()
  expect(module.localCompendiumState('owner','spells')).toBe('outdated')
  expect(module.localCompendiumState('stranger','spells')).toBe('not-saved')
  const before=commands.length
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  expect(commands).toHaveLength(before);expect(get).toHaveBeenCalledOnce()
  get.mockImplementation(async(path:string)=>path.endsWith('/local-index')?{owner:'owner',kind:'spells',revision}:{owner:'owner',revision,version:'local-compendium-1'})
  await module.saveLocalCompendium('owner','spells',new AbortController().signal)
  expect(module.localCompendiumState('owner','spells')).toBe('saved')
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toMatchObject({revision})
  expect(get).toHaveBeenCalledTimes(3);module.releaseLocalCompendium()
 })
 it('reports a missing disk copy and skips repeated opens without removing the saved hint',async()=>{
  vi.stubGlobal('Worker',class extends TestWorker{postMessage(command:any){commands.push(command.action);queueMicrotask(()=>this.onmessage?.({data:{id:command.id,value:null}}))}})
  const module=await import('./local-compendium-client')
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  expect(module.localCompendiumState('owner','spells')).toBe('missing')
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  expect(commands).toEqual(['open']);expect(get).not.toHaveBeenCalled();expect(marker).not.toBeNull();module.releaseLocalCompendium()
 })
 it('allows a category refreshed in another tab to be validated again',async()=>{
  get.mockResolvedValueOnce({owner:'owner',revision:'b'.repeat(64),version:'local-compendium-1'}).mockResolvedValue({owner:'owner',revision,version:'local-compendium-1'})
  const module=await import('./local-compendium-client')
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  storageChanged!({key:'codex:local-compendium:v1'})
  expect(module.localCompendiumState('owner','spells')).toBe('saved')
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toMatchObject({revision})
  module.releaseLocalCompendium()
 })
 it('clears timeout backoff after a successful explicit save',async()=>{
  vi.useFakeTimers();vi.stubGlobal('Worker',class extends TestWorker{postMessage(){}})
  const module=await import('./local-compendium-client')
  const stalled=module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  await vi.advanceTimersByTimeAsync(1500);await stalled
  vi.stubGlobal('Worker',TestWorker)
  get.mockImplementation(async(path:string)=>path.endsWith('/local-index')?{owner:'owner',kind:'spells',revision}:{owner:'owner',revision,version:'local-compendium-1'})
  await module.saveLocalCompendium('owner','spells',new AbortController().signal)
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toMatchObject({revision})
  module.releaseLocalCompendium()
 })
 it('does not let a cancelled late revision mark the current category outdated',async()=>{
  let finish!:(v:unknown)=>void;get.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const module=await import('./local-compendium-client'),controller=new AbortController()
  const pending=module.queryLocalCompendium('owner','spells',query,controller.signal)
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));controller.abort();await pending
  finish({owner:'owner',revision:'b'.repeat(64),version:'local-compendium-1'});await Promise.resolve()
  expect(module.localCompendiumState('owner','spells')).toBe('saved');module.releaseLocalCompendium()
 })
 it('bounds a silent worker to 1.5 seconds and backs off subsequent local attempts',async()=>{
  vi.useFakeTimers()
  vi.stubGlobal('Worker',class extends TestWorker{postMessage(){commands.push('silent-open')}})
  const module=await import('./local-compendium-client')
  const result=module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  await vi.advanceTimersByTimeAsync(1499);expect(terminated).toBe(0)
  await vi.advanceTimersByTimeAsync(1);expect(await result).toBeUndefined();expect(terminated).toBe(1)
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toBeUndefined()
  expect(created).toBe(1);expect(get).not.toHaveBeenCalled()
 })
 it('bounds a stalled revision check and aborts its network request before server fallback',async()=>{
  vi.useFakeTimers();get.mockImplementation(()=>new Promise(()=>{}))
  const module=await import('./local-compendium-client')
  const result=module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  await vi.advanceTimersByTimeAsync(0);expect(get).toHaveBeenCalledOnce()
  const signal=get.mock.calls[0]![1].signal as AbortSignal
  await vi.advanceTimersByTimeAsync(1500)
  expect(await result).toBeUndefined();expect(signal.aborted).toBe(true);expect(commands).not.toContain('query')
 })
 it('returns promptly when a search is cancelled while its worker is still opening',async()=>{
  vi.useFakeTimers()
  vi.stubGlobal('Worker',class extends TestWorker{postMessage(){}})
  const module=await import('./local-compendium-client'),controller=new AbortController()
  const result=module.queryLocalCompendium('owner','spells',query,controller.signal)
  controller.abort();expect(await result).toBeUndefined();expect(get).not.toHaveBeenCalled()
  module.releaseLocalCompendium()
 })
 it('skips worker and network entirely without a saved owner/category hint',async()=>{
  marker=null;const module=await import('./local-compendium-client')
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toBeUndefined()
  module.prepareSavedCompendium('owner');expect(created).toBe(0);expect(get).not.toHaveBeenCalled()
 })
 it('prepares only device data, then requires authoritative validation before first query',async()=>{
  const module=await import('./local-compendium-client')
  module.prepareSavedCompendium('owner');await Promise.resolve()
  expect(get).not.toHaveBeenCalled();expect(commands).not.toContain('query')
  get.mockResolvedValue({owner:'owner',revision,version:'local-compendium-1'})
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toMatchObject({revision})
  expect(get).toHaveBeenCalledOnce()
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal);expect(get).toHaveBeenCalledOnce()
  module.invalidateLocalCompendium();await module.queryLocalCompendium('owner','spells',query,new AbortController().signal);expect(get).toHaveBeenCalledTimes(2)
  module.releaseLocalCompendium()
 })
 it.each(['offline','unauthorized','changed','wrong-owner','wrong-version'])('never queries a disk copy after %s validation',async(mode)=>{
  const module=await import('./local-compendium-client')
  if(mode==='offline'||mode==='unauthorized')get.mockRejectedValue(Error(mode))
  else get.mockResolvedValue({owner:mode==='wrong-owner'?'stranger':'owner',revision:mode==='changed'?'b'.repeat(64):revision,version:mode==='wrong-version'?'old':'local-compendium-1'})
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toBeUndefined()
  expect(commands).not.toContain('query');module.releaseLocalCompendium()
 })
 it('discards an old account validation that resolves after clearing the scope',async()=>{
  let finish!:(v:unknown)=>void;get.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
  const module=await import('./local-compendium-client'),loading=module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
  module.clearLocalCompendium();finish({owner:'owner',revision,version:'local-compendium-1'})
  expect(await loading).toBeUndefined();expect(marker).toBeNull();expect(terminated).toBe(1);expect(commands).not.toContain('query')
 })
 it('preserves server fallback when worker construction itself is blocked',async()=>{
  vi.stubGlobal('Worker',class{constructor(){throw Error('CSP blocked worker')}})
  const module=await import('./local-compendium-client')
  expect(()=>module.prepareSavedCompendium('owner')).not.toThrow()
  expect(await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)).toBeUndefined()
 })
 it('invalidates a parsed category immediately when another tab changes the device scope',async()=>{
  const module=await import('./local-compendium-client')
  get.mockResolvedValue({owner:'owner',revision,version:'local-compendium-1'})
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  storageChanged!({key:'codex:local-compendium:v1'})
  expect(terminated).toBe(1)
  await module.queryLocalCompendium('owner','spells',query,new AbortController().signal)
  expect(get).toHaveBeenCalledTimes(2);module.releaseLocalCompendium()
 })
})
