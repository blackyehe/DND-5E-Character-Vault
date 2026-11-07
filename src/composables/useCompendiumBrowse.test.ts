import {beforeEach,afterEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({get:vi.fn(),local:vi.fn(),invalidate:vi.fn()}))
vi.mock('../lib/api',async original=>({...await original<object>(),api:{get:state.get}}))
vi.mock('../lib/local-compendium-client',()=>({localCompendiumEnabled:true,localCompendiumState:()=> 'not-saved',queryLocalCompendium:state.local,invalidateLocalCompendium:state.invalidate,acceptCompendiumRevision:vi.fn()}))
vi.mock('../lib/compendium-preparation',()=>({prioritizeCompendium:vi.fn()}))
import {useCompendiumBrowse} from './useCompendiumBrowse'
import {ApiError} from '../lib/api'
const query={query:'',page:1,facets:{},items:{category:'',weapon:'',damage:'',armour:''}}
const page=(name:string)=>({revision:name,entries:[{index:name,name}],page:1,pageSize:25,pages:1,total:1})
beforeEach(()=>{vi.clearAllMocks();state.local.mockResolvedValue(undefined)})
afterEach(()=>vi.useRealTimers())
it('keeps bounded memory pages scoped to the current account',async()=>{
 let owner='first';state.get.mockResolvedValueOnce(page('first')).mockResolvedValueOnce(page('second'))
 const browse=useCompendiumBrowse(()=>owner);expect(await browse.load('spells',query)).toBe(true);expect(browse.response.value?.revision).toBe('first')
 owner='second';expect(await browse.load('spells',query)).toBe(true);expect(browse.response.value?.revision).toBe('second');expect(state.get).toHaveBeenCalledTimes(2)
})
it('does not paint a late response after the owner changes',async()=>{
 let finish!:(v:unknown)=>void,owner='first';state.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 const browse=useCompendiumBrowse(()=>owner),task=browse.load('spells',query);await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));owner='second';finish(page('first'))
 expect(await task).toBe(false);expect(browse.response.value).toBeNull()
})
it('clears displayed private results and cached pages after an authoritative access denial',async()=>{
 state.get.mockResolvedValueOnce(page('old'));const browse=useCompendiumBrowse(()=> 'owner');await browse.load('spells',query)
 state.get.mockRejectedValueOnce(new ApiError(401,'Access ended'));expect(await browse.load('spells',query,true)).toBe(false);expect(browse.response.value).toBeNull();expect(browse.error.value).toBe('Access ended')
 state.get.mockResolvedValueOnce(page('new'));expect(await browse.load('spells',query)).toBe(true);expect(browse.response.value?.revision).toBe('new')
})
it('cancels a slow local attempt when another category replaces it',async()=>{
 state.local.mockImplementation(()=>new Promise(()=>{}));const browse=useCompendiumBrowse(()=> 'owner'),first=browse.load('spells',query)
 state.local.mockResolvedValueOnce(undefined);state.get.mockResolvedValueOnce(page('classes'));const second=browse.load('classes',query)
 expect(await first).toBe(false);expect(await second).toBe(true);expect(browse.response.value?.revision).toBe('classes');expect(browse.error.value).toBe('')
})
