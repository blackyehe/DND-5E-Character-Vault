import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {clearCreationOptionsCache,loadCreationOptions,type CreationOptionsStorage} from './creation-options-cache'
import type {CreationOptions} from './srd'
const etag='"'+'a'.repeat(64)+'"',changedTag='"'+'b'.repeat(64)+'"'
const options=():CreationOptions=>({classes:[],races:[],backgrounds:[],subraces:[],subclasses:[],feats:[],languages:[],spells:[]})
let saved:Awaited<ReturnType<CreationOptionsStorage['read']>>
let storage:CreationOptionsStorage
const network=vi.fn()
const full=(value=options(),tag=etag)=>new Response(JSON.stringify(value),{headers:{ETag:tag}})
const persisted=()=>vi.waitFor(()=>expect(storage.write).toHaveBeenCalled())
beforeEach(()=>{
 clearCreationOptionsCache();saved=undefined;network.mockReset();vi.stubGlobal('fetch',network)
 storage={read:vi.fn(async()=>saved?structuredClone(saved):undefined),write:vi.fn(async v=>{saved=structuredClone(v)}),clear:vi.fn(async()=>{saved=undefined})}
})
afterEach(()=>vi.unstubAllGlobals())
describe('validated persisted creation options',()=>{
 it('persists a first response and uses it only after an authenticated revision check',async()=>{
  const value=options();network.mockResolvedValueOnce(full(value))
  expect(await loadCreationOptions('owner',false,storage)).toEqual(value)
  await persisted();expect(saved?.owner).toBe('owner')
  network.mockResolvedValueOnce(new Response(null,{status:304,headers:{ETag:etag}}))
  expect(await loadCreationOptions('owner',false,storage)).toEqual(value)
  expect(network.mock.calls[1]?.[1]).toMatchObject({credentials:'include',cache:'no-store',headers:{'If-None-Match':etag}})
 })
 it('replaces changed definitions and forces a full fetch for Retry library',async()=>{
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage);await persisted()
  const changed={...options(),spells:[{index:'new',name:'New spell'}]} as CreationOptions
  network.mockResolvedValueOnce(full(changed,changedTag))
  expect(await loadCreationOptions('owner',false,storage)).toEqual(changed)
  await vi.waitFor(()=>expect(saved?.etag).toBe(changedTag))
  network.mockResolvedValueOnce(full(changed,changedTag));await loadCreationOptions('owner',true,storage)
  expect(network.mock.calls[2]?.[1].headers).not.toHaveProperty('If-None-Match')
 })
 it('does not send another account’s tag or expose its cached value',async()=>{
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage);await persisted()
  network.mockResolvedValueOnce(full());await loadCreationOptions('other-owner',false,storage)
  expect(network.mock.calls[1]?.[1].headers).not.toHaveProperty('If-None-Match')
  await vi.waitFor(()=>expect(saved?.owner).toBe('other-owner'))
 })
 it('ignores corrupted or expired browser copies',async()=>{
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage);await persisted()
  saved!.value.spells.push({index:'tampered',name:'Changed'} as any)
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage)
  expect(network.mock.calls[1]?.[1].headers).not.toHaveProperty('If-None-Match')
  await vi.waitFor(()=>expect(storage.write).toHaveBeenCalledTimes(2));saved!.expires=0
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage)
  expect(network.mock.calls[2]?.[1].headers).not.toHaveProperty('If-None-Match')
 })
 it('continues without storage and never serves an offline or unauthorized cached copy',async()=>{
  vi.mocked(storage.read).mockRejectedValueOnce(Error('Blocked storage'))
  vi.mocked(storage.write).mockRejectedValueOnce(Error('Quota exceeded'))
  network.mockResolvedValueOnce(full());expect(await loadCreationOptions('owner',false,storage)).toEqual(options());await persisted()
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage)
  await vi.waitFor(()=>expect(saved).toBeDefined())
  network.mockRejectedValueOnce(Error('Offline'))
  await expect(loadCreationOptions('owner',false,storage)).rejects.toThrow('Offline')
  network.mockResolvedValueOnce(new Response(JSON.stringify({error:'Not authenticated'}),{status:401}))
  await expect(loadCreationOptions('owner',false,storage)).rejects.toThrow('Not authenticated')
 })
 it('rejects an in-flight conditional hit after logout clears the cache scope',async()=>{
  network.mockResolvedValueOnce(full());await loadCreationOptions('owner',false,storage);await persisted()
  let finish!:(value:Response)=>void
  network.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve}))
  const loading=loadCreationOptions('owner',false,storage)
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'))
  clearCreationOptionsCache();finish(new Response(null,{status:304,headers:{ETag:etag}}))
  await expect(loading).rejects.toThrow('account changed')
 })
 it('returns the first response without waiting for optional disk writes',async()=>{
  vi.mocked(storage.write).mockImplementation(()=>new Promise(()=>{}))
  network.mockResolvedValueOnce(full())
  await expect(loadCreationOptions('owner',false,storage)).resolves.toEqual(options())
  await persisted()
 })
 it('cancels a scheduled old-account write when logout occurs before it starts',async()=>{
  network.mockResolvedValueOnce(full())
  await loadCreationOptions('owner',false,storage)
  clearCreationOptionsCache()
  await new Promise(resolve=>setTimeout(resolve,10))
  expect(storage.write).not.toHaveBeenCalled()
 })
})
