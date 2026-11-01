import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {CompendiumDetailPreloader} from './compendium-detail-preloader'
import {COMPENDIUM_PRELOAD_LIMITS as limits} from '../../shared/compendium-details'
const queues:CompendiumDetailPreloader[]=[]
function fixture(){const preload=vi.fn(async(_o:string,_k:string,_i:string[],_s:AbortSignal,_b:number):Promise<number|undefined>=>100),queue=new CompendiumDetailPreloader({preload});queues.push(queue);return {preload,queue}}
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>{queues.splice(0).forEach(q=>q.dispose());vi.useRealTimers()})
it('waits for idle and only processes 25 unique visible entries, three at a time',async()=>{
 const {preload,queue}=fixture();queue.setPage('owner','spells',Array.from({length:30},(_,i)=>'entry-'+i));await vi.advanceTimersByTimeAsync(5000);expect(preload).not.toHaveBeenCalled()
 queue.pause(false);await vi.advanceTimersByTimeAsync(limits.idleMs-1);expect(preload).not.toHaveBeenCalled()
 await vi.advanceTimersByTimeAsync(5000);expect(preload.mock.calls.flatMap(c=>c[2])).toEqual(Array.from({length:25},(_,i)=>'entry-'+i));expect(preload.mock.calls.every(c=>c[2].length<=3)).toBe(true)
})
it('cancels old pages on search changes and resumes only the replacement page',async()=>{
 const {preload,queue}=fixture();let reject!:(e:Error)=>void
 preload.mockImplementationOnce((_o,_k,_i,signal)=>new Promise((_resolve,r)=>{reject=r;signal.addEventListener('abort',()=>reject(Error('Cancelled')))}))
 queue.pause(false);queue.setPage('owner','spells',['old']);await vi.advanceTimersByTimeAsync(900)
 const signal=preload.mock.calls[0]![3];queue.setPage('owner','classes',['new']);expect(signal.aborted).toBe(true)
 await vi.advanceTimersByTimeAsync(2000);expect(preload.mock.calls.map(c=>c[2])).toEqual([['old'],['new']])
})
it('yields to foreground/hidden/offline state and never starts concurrent batches',async()=>{
 const {preload,queue}=fixture();let finish!:(n:number)=>void
 preload.mockImplementationOnce(()=>new Promise(r=>{finish=r}));queue.pause(false);queue.setPage('owner','spells',['one','two','three','four'])
 await vi.advanceTimersByTimeAsync(900);queue.pause(true);await vi.advanceTimersByTimeAsync(5000);expect(preload).toHaveBeenCalledOnce()
 finish(100);await vi.advanceTimersByTimeAsync(5000);expect(preload).toHaveBeenCalledOnce()
 queue.pause(false);await vi.advanceTimersByTimeAsync(2000);expect(preload.mock.calls[1]![2]).toEqual(['one','two','three'])
})
it('stops at the byte budget and after repeated failures; a new page can try again',async()=>{
 const f=fixture();f.preload.mockResolvedValue(limits.batchBytes);f.queue.pause(false);f.queue.setPage('owner','spells',Array.from({length:25},(_,i)=>String(i)))
 await vi.advanceTimersByTimeAsync(10000);expect(f.preload).toHaveBeenCalledTimes(4)
 f.preload.mockRejectedValue(Error('Busy'));f.queue.setPage('owner','spells',['a','b','c','d','e','f','g']);await vi.advanceTimersByTimeAsync(10000);expect(f.preload).toHaveBeenCalledTimes(6)
})
it('retries a busy cross-tab lock without consuming the page or making parallel requests',async()=>{
 const {preload,queue}=fixture();preload.mockResolvedValueOnce(undefined);queue.pause(false);queue.setPage('owner','spells',['one'])
 await vi.advanceTimersByTimeAsync(2500);expect(preload).toHaveBeenCalledTimes(2);expect(preload.mock.calls.map(c=>c[2])).toEqual([['one'],['one']])
 queue.dispose();await vi.advanceTimersByTimeAsync(10000);expect(preload).toHaveBeenCalledTimes(2)
})
