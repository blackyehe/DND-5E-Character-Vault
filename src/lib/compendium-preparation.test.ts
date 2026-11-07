import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {CompendiumPreparation,compendiumPauseReason,preparationStatus} from './compendium-preparation'
import type {BrowseKind} from '../../shared/compendium-browse'
const services:CompendiumPreparation[]=[]
function fixture(){
 const states=new Map<string,string>(),visited:string[]=[],signals:AbortSignal[]=[]
 const check=vi.fn(async(owner:string,kind:BrowseKind,signal:AbortSignal)=>{visited.push(owner+':'+kind);signals.push(signal);return states.get(kind)==='saved'})
 const save=vi.fn(async(_owner:string,kind:BrowseKind)=>{states.set(kind,'saved')})
 const lock=vi.fn(async(_owner:string,run:()=>Promise<void>)=>{await run();return true})
 const service=new CompendiumPreparation({check,save,state:(_owner,kind)=>states.get(kind)??'not-saved',mark:(_owner,kind,state)=>{states.set(kind,state)},cancel:vi.fn(),lock})
 services.push(service)
 return {service,states,visited,signals,check,save,lock}
}
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>{services.splice(0).forEach(s=>s.dispose());vi.useRealTimers()})
describe('automatic idle preparation',()=>{
 it('identifies each existing route, visibility and connection pause without blocking normal pages',()=>{
  expect(compendiumPauseReason('/rooms/test',false,true)).toBe('room')
  expect(compendiumPauseReason('/compendium',true,true)).toBe('hidden')
  expect(compendiumPauseReason('/compendium',false,false)).toBe('offline')
  expect(compendiumPauseReason('/login',false,true)).toBe('login')
  for(const path of ['/compendium','/rooms','/characters/new','/'])expect(compendiumPauseReason(path,false,true)).toBe('')
 })
 it('replaces the room reason with foreground activity and clears it when idle',async()=>{
  const f=fixture();f.service.configure('owner',true,'room')
  expect(preparationStatus.pauseReason).toBe('room')
  f.service.configure('owner',true)
  expect(preparationStatus.pauseReason).toBe('foreground')
  f.service.configure('owner',false)
  expect(preparationStatus.pauseReason).toBe('');expect(preparationStatus.phase).toBe('queued')
  await vi.advanceTimersByTimeAsync(1500);expect(f.check).toHaveBeenCalledOnce()
 })
 it('does not leave a pause reason after signing out',()=>{
  const f=fixture();f.service.configure('owner',true,'offline');f.service.configure('',true)
  expect(preparationStatus.phase).toBe('idle');expect(preparationStatus.pauseReason).toBe('')
 })
 it('starts only after authentication and idle, then downloads sequentially',async()=>{
  const f=fixture();f.service.configure('',false);await vi.advanceTimersByTimeAsync(10000);expect(f.save).not.toHaveBeenCalled()
  f.service.configure('owner',false);await vi.advanceTimersByTimeAsync(1499);expect(f.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);expect(f.visited).toEqual(['owner:spells']);expect(f.save).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000);expect(f.visited).toEqual(['owner:spells','owner:equipment'])
 })
 it('prioritizes the category being opened without parallel exports',async()=>{
  const f=fixture();f.service.configure('owner',false);f.service.prioritize('magic-items')
  let finish!:()=>void
  f.save.mockImplementationOnce(()=>new Promise<void>(r=>{finish=r}))
  await vi.advanceTimersByTimeAsync(1500);expect(f.visited).toEqual(['owner:magic-items'])
  await vi.advanceTimersByTimeAsync(10000);expect(f.save).toHaveBeenCalledOnce()
  finish();await vi.advanceTimersByTimeAsync(1000);expect(f.visited[1]).toBe('owner:spells')
 })
 it('aborts preparation for foreground activity and resumes after idle',async()=>{
  const f=fixture()
  let activeSignal:AbortSignal|undefined
  f.check.mockImplementationOnce(async(_o,_k,signal)=>{activeSignal=signal;return new Promise<boolean>((_r,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))})
  f.service.configure('owner',false);await vi.advanceTimersByTimeAsync(1500)
  f.service.configure('owner',true);expect(activeSignal?.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(10000);expect(f.save).not.toHaveBeenCalled()
  f.service.configure('owner',false);await vi.advanceTimersByTimeAsync(1500);expect(f.save).toHaveBeenCalledOnce()
 })
 it('reuses unchanged saved categories without downloading again',async()=>{
  const f=fixture();f.states.set('spells','saved');f.service.configure('owner',false)
  await vi.advanceTimersByTimeAsync(1500);expect(f.save).not.toHaveBeenCalled();expect(f.visited).toEqual(['owner:spells'])
 })
 it('does not export when another tab owns the preparation lock',async()=>{
  const f=fixture();f.lock.mockResolvedValue(false);f.service.configure('owner',false)
  await vi.advanceTimersByTimeAsync(1500);expect(f.check).not.toHaveBeenCalled();expect(f.save).not.toHaveBeenCalled()
 })
 it('keeps a failing category on backoff while preparing the remaining categories',async()=>{
  const f=fixture();f.save.mockRejectedValueOnce(Error('413'));f.service.configure('owner',false)
  await vi.advanceTimersByTimeAsync(2500);expect(f.visited).toEqual(['owner:spells','owner:equipment']);expect(f.save).toHaveBeenCalledTimes(2)
 })
 it('does not immediately re-download categories evicted by the storage budget',async()=>{
  const f=fixture();f.states.set('spells','unavailable');f.service.configure('owner',false)
  await vi.advanceTimersByTimeAsync(1500);expect(f.visited).toEqual(['owner:equipment'])
 })
 it('does not adopt a late task result after switching accounts',async()=>{
  const f=fixture();let finish!:(value:boolean)=>void
  f.check.mockImplementationOnce(()=>new Promise<boolean>(r=>{finish=r}))
  f.service.configure('old',false);await vi.advanceTimersByTimeAsync(1500)
  f.service.configure('new',false);finish(false);await vi.advanceTimersByTimeAsync(1000)
  expect(f.save.mock.calls.every(([owner])=>owner==='new')).toBe(true);expect(preparationStatus.owner).toBe('new')
 })
})
