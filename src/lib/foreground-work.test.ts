import {afterEach,describe,expect,it,vi} from 'vitest'
import {api} from './api'
import {foregroundBusy,onForegroundWork} from './foreground-work'
afterEach(()=>vi.unstubAllGlobals())
describe('foreground request priority',()=>{
 it('announces work before dispatch and holds priority through response parsing',async()=>{
  let body!:(value:unknown)=>void
  const events:boolean[]=[];const stop=onForegroundWork(busy=>events.push(busy))
  vi.stubGlobal('fetch',vi.fn(async()=>{expect(foregroundBusy()).toBe(true);return {ok:true,json:()=>new Promise(r=>{body=r})}}))
  const request=api.get('/api/example')
  await vi.waitFor(()=>expect(body).toBeTypeOf('function'));expect(foregroundBusy()).toBe(true)
  body({ok:true});await request
  expect(foregroundBusy()).toBe(false);expect(events).toEqual([true,false]);stop()
 })
 it('does not let background requests preempt themselves, and releases failed foreground work',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>{expect(foregroundBusy()).toBe(false);return {}}})))
  await api.get('/api/background',{background:true})
  vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('network')}))
  await expect(api.get('/api/example')).rejects.toThrow('network');expect(foregroundBusy()).toBe(false)
 })
})
