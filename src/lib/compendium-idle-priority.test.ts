import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({check:vi.fn(async()=>true),save:vi.fn(),cancel:vi.fn()}))
vi.mock('./local-compendium-client',()=>({localCompendiumEnabled:true,checkSavedCompendium:state.check,saveLocalCompendium:state.save,localCompendiumState:()=> 'saved',setLocalCategoryState:vi.fn(),cancelLocalPreparation:state.cancel,onLocalCompendiumChange:vi.fn(),invalidateLocalCompendium:vi.fn()}))
import {configureCompendiumPreparation,preparationStatus} from './compendium-preparation'
import {CompendiumDetailPreloader,detailPreloadWaiting} from './compendium-detail-preloader'
import {beginForegroundWork,onForegroundWork} from './foreground-work'
let queue:CompendiumDetailPreloader|undefined,stop:()=>void=()=>{}
beforeEach(()=>{vi.useFakeTimers();state.check.mockClear();vi.stubGlobal('navigator',{locks:{request:async(_n:unknown,_o:unknown,run:(lock:unknown)=>Promise<unknown>)=>run({})}})})
afterEach(()=>{stop();configureCompendiumPreparation(undefined,true);queue?.dispose();queue=undefined;vi.useRealTimers();vi.unstubAllGlobals()})
it('keeps visible details ahead of background indexes, including gaps, then resumes indexes',async()=>{
 let finish!:(bytes:number)=>void
 queue=new CompendiumDetailPreloader({preload:()=>new Promise(resolve=>{finish=resolve})})
 configureCompendiumPreparation('owner',false);queue.pause(false);queue.setPage('owner','spells',['one'])
 expect(preparationStatus.pauseReason).toBe('details');await vi.advanceTimersByTimeAsync(5000);expect(state.check).not.toHaveBeenCalled();expect(detailPreloadWaiting()).toBe(true)
 finish(100);await vi.advanceTimersByTimeAsync(0);expect(detailPreloadWaiting()).toBe(false);await vi.advanceTimersByTimeAsync(1499);expect(state.check).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(state.check).toHaveBeenCalledOnce()
})
it('still gives a click first priority and restores visible details before index work',async()=>{
 const preload=vi.fn((_o:string,_k:unknown,_i:string[],signal:AbortSignal)=>new Promise<number>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Cancelled')))))
 queue=new CompendiumDetailPreloader({preload});stop=onForegroundWork(busy=>queue?.pause(busy));configureCompendiumPreparation('owner',false);queue.pause(false);queue.setPage('owner','spells',['one'])
 await vi.advanceTimersByTimeAsync(900);const finish=beginForegroundWork();expect(preload.mock.calls[0]![3].aborted).toBe(true);expect(preparationStatus.pauseReason).toBe('foreground');await vi.advanceTimersByTimeAsync(2000);expect(state.check).not.toHaveBeenCalled()
 finish();expect(preparationStatus.pauseReason).toBe('details');await vi.advanceTimersByTimeAsync(900);expect(preload).toHaveBeenCalledTimes(2);expect(state.check).not.toHaveBeenCalled()
})
