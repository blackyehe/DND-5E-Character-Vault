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
 it('saves one small batch in one transaction and evicts enough old entries',async()=>{
  records=Array.from({length:200},(_,i)=>({key:'old-'+i,value:row('owner',Date.now()-1000+i)}))
  const entries=['a','b','c'].map(key=>({key,row:{...row(),index:key}})),saving=module.compendiumDetailStorage.writeMany!(entries)
  connect();await saving
  expect(transactions).toHaveLength(1);expect(removed.mock.calls.map(([key])=>key)).toEqual(['old-0','old-1','old-2'])
  expect(put.mock.calls.map(([value,key])=>[key,value.index])).toEqual([['a','a'],['b','b'],['c','c']])
 })
 it('rejects mixed-owner, oversized and duplicate-key batches before touching disk',async()=>{
  await module.compendiumDetailStorage.writeMany!([{key:'a',row:row()},{key:'b',row:row('other')}])
  await module.compendiumDetailStorage.writeMany!([{key:'a',row:row()},{key:'a',row:row()}])
  await module.compendiumDetailStorage.writeMany!(['a','b','c','d'].map(key=>({key,row:row()})))
  await module.compendiumDetailStorage.writeMany!([{key:'a',row:{...row(),payload:'x'.repeat(module.DETAIL_MAX_BYTES+1)}}])
  expect(opens).toHaveLength(0)
 })
 it('enforces the same total byte budget for batch writes',async()=>{
  const payload='x'.repeat(module.DETAIL_MAX_BYTES)
  records=Array.from({length:16},(_,i)=>({key:'old-'+i,value:{...row('owner',Date.now()-1000+i),payload}}))
  const saving=module.compendiumDetailStorage.writeMany!(['a','b','c'].map(key=>({key,row:{...row(),index:key,payload}})))
  connect();await saving
  expect(removed.mock.calls.map(([key])=>key)).toEqual(['old-0','old-1','old-2']);expect(put).toHaveBeenCalledTimes(3)
 })
 it('cancels deferred or active batch transactions when foreground work interrupts',async()=>{
  const pending=new AbortController(),first=module.compendiumDetailStorage.writeMany!([{key:'a',row:row()}],pending.signal)
  pending.abort();connect();await first;expect(transactions).toHaveLength(0);expect(put).not.toHaveBeenCalled()
  const active=new AbortController(),second=module.compendiumDetailStorage.writeMany!([{key:'b',row:row()}],active.signal)
  connect();active.abort();await second;expect(transactions[0].abort).toHaveBeenCalledOnce();expect(put).not.toHaveBeenCalled()
 })
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
