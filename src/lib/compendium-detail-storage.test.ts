import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {StoredCompendiumDetail} from './compendium-detail-storage'

let module:typeof import('./compendium-detail-storage'),opens:any[],records:{key:string;value:StoredCompendiumDetail}[],transactions:any[]
const removed=vi.fn(),put=vi.fn(),cleared=vi.fn()
const row=(owner='owner',savedAt=Date.now()):StoredCompendiumDetail=>({owner,kind:'spells',index:'one',version:'compendium-details-1',revision:'a'.repeat(64),digest:'b'.repeat(64),payload:'{}',savedAt})
beforeEach(async()=>{
 vi.resetModules();opens=[];records=[];transactions=[];removed.mockClear();put.mockClear();cleared.mockClear()
 vi.stubGlobal('indexedDB',{open:()=>{const request:any={};opens.push(request);return request}})
 module=await import('./compendium-detail-storage')
})
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()})
function connect(request=opens.at(-1)){
 request.result={close:vi.fn(),transaction:()=>{
  const tx:any={abort:vi.fn()};transactions.push(tx)
  const finish=()=>queueMicrotask(()=>tx.oncomplete?.())
  tx.objectStore=()=>({
   clear:()=>{cleared();finish()},delete:removed,put:(...args:unknown[])=>{put(...args);finish()},
   openCursor:()=>{
    const cursor:any={};let position=0
    const next=()=>queueMicrotask(()=>{const value=records[position++];cursor.result=value?{primaryKey:value.key,value:value.value,delete:()=>removed(value.key),continue:next}:null;cursor.onsuccess?.()})
    next();return cursor
   },
  })
  return tx
 }}
 request.onsuccess()
}
describe('bounded full-entry disk storage',()=>{
 it('evicts the oldest entry to enforce the 200-entry limit',async()=>{
  records=Array.from({length:200},(_,i)=>({key:'old-'+i,value:row('owner',Date.now()-1000+i)}))
  const saving=module.compendiumDetailStorage.write('new',row());connect();await saving
  expect(removed).toHaveBeenCalledExactlyOnceWith('old-0');expect(put).toHaveBeenCalledOnce()
 })
 it('enforces byte limits and removes a previous owner or invalid disk rows',async()=>{
  const payload='x'.repeat(module.DETAIL_MAX_BYTES)
  records=Array.from({length:16},(_,i)=>({key:'old-'+i,value:{...row('owner',Date.now()-1000+i),payload}}))
  records.push({key:'private-other-owner',value:row('stranger')},{key:'expired',value:row('owner',Date.now()-8*86400000)})
  const saving=module.compendiumDetailStorage.write('new',{...row(),payload});connect();await saving
  expect(removed.mock.calls.map(([key])=>key)).toEqual(['private-other-owner','expired','old-0'])
  expect(put).toHaveBeenCalledOnce()
  await module.compendiumDetailStorage.write('oversized',{...row(),payload:payload+'x'})
  expect(put).toHaveBeenCalledOnce()
 })
 it('cancels a pending write after account invalidation',async()=>{
  const saving=module.compendiumDetailStorage.write('new',row());module.suspendCompendiumDetailStorage();connect();await saving
  expect(transactions).toHaveLength(0);expect(put).not.toHaveBeenCalled()
 })
 it('does not cancel a logout clear when the next account starts before IndexedDB opens',async()=>{
  const clearing=module.compendiumDetailStorage.clear();module.suspendCompendiumDetailStorage();connect();await clearing
  expect(cleared).toHaveBeenCalledOnce();expect(transactions[0].abort).not.toHaveBeenCalled()
 })
})
