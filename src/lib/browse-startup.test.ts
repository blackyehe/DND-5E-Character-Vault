import {afterEach,expect,it,vi} from 'vitest'
import {browseStartup} from './browse-startup'
afterEach(()=>vi.useRealTimers())
it('does not issue a browse request when current device results are quick',async()=>{
 vi.useFakeTimers();const server=vi.fn(),result=await browseStartup(async()=>({revision:'current'}),server,new AbortController().signal)
 await vi.advanceTimersByTimeAsync(1000);expect(result).toEqual({value:{revision:'current'},device:true});expect(server).not.toHaveBeenCalled()
})
it('starts fallback after 200ms, rather than waiting for the 1500ms validation deadline',async()=>{
 vi.useFakeTimers();let localSignal!:AbortSignal;const server=vi.fn(async()=>({revision:'authoritative'}))
 const result=browseStartup(signal=>{localSignal=signal;return new Promise(()=>{})},server,new AbortController().signal)
 await vi.advanceTimersByTimeAsync(199);expect(server).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1)
 expect(await result).toEqual({value:{revision:'authoritative'},device:false});expect(server).toHaveBeenCalledOnce();expect(localSignal.aborted).toBe(true)
})
it('starts the server immediately on missing/invalid device data and on a failed worker',async()=>{
 for(const probe of [async()=>undefined,async()=>{throw Error('unavailable')}]){const server=vi.fn(async()=>123);expect(await browseStartup(probe,server,new AbortController().signal)).toEqual({value:123,device:false});expect(server).toHaveBeenCalledOnce()}
})
it('cancels a started server read if a valid device result finishes first',async()=>{
 vi.useFakeTimers();let release!:(v:number)=>void,serverSignal!:AbortSignal
 const result=browseStartup<number>(()=>new Promise(resolve=>{release=resolve}),signal=>{serverSignal=signal;return new Promise(()=>{})},new AbortController().signal)
 await vi.advanceTimersByTimeAsync(200);release(12);expect(await result).toEqual({value:12,device:true});expect(serverSignal.aborted).toBe(true)
})
it('surfaces an authoritative access denial and never publishes a later device result',async()=>{
 vi.useFakeTimers();let release!:(v:number)=>void;const error=Object.assign(Error('Denied'),{status:401})
 const result=browseStartup<number>(()=>new Promise(resolve=>{release=resolve}),async()=>{throw error},new AbortController().signal),check=expect(result).rejects.toBe(error)
 await vi.advanceTimersByTimeAsync(200);await check;release(9);await Promise.resolve()
})
it('finishes promptly on navigation even when both adapters ignore cancellation',async()=>{
 vi.useFakeTimers();const controller=new AbortController(),server=vi.fn(()=>new Promise<number>(()=>{}))
 const result=browseStartup<number>(()=>new Promise(()=>{}),server,controller.signal),check=expect(result).rejects.toThrow('cancelled')
 await vi.advanceTimersByTimeAsync(200);controller.abort();await check;expect(server).toHaveBeenCalledOnce()
})
