import type {BrowseKind} from '../../shared/compendium-kinds'
import type {COMPENDIUM_DETAIL_VERSION} from '../../shared/compendium-details'
import {COMPENDIUM_PRELOAD_LIMITS} from '../../shared/compendium-details'

export const DETAIL_MAX_BYTES=1024*1024,DETAIL_TOTAL_BYTES=16*1024*1024,DETAIL_MAX_ENTRIES=200,DETAIL_LIFETIME=7*86400000
export interface StoredCompendiumDetail {owner:string;kind:BrowseKind;index:string;version:typeof COMPENDIUM_DETAIL_VERSION;revision:string;digest:string;payload:string;savedAt:number}
export interface CompendiumDetailStorage {read:(key:string)=>Promise<StoredCompendiumDetail|undefined>;write:(key:string,value:StoredCompendiumDetail)=>Promise<unknown>;writeMany?:(entries:{key:string;row:StoredCompendiumDetail}[],signal?:AbortSignal)=>Promise<unknown>;clear:()=>Promise<unknown>}
let generation=0
const writes=new Set<IDBTransaction>()
export function suspendCompendiumDetailStorage(){++generation;for(const tx of writes)try{tx.abort()}catch{/* Complete. */}writes.clear()}
function operation(action:'read'|'write'|'clear',key?:string,value?:StoredCompendiumDetail,batch?:{key:string;row:StoredCompendiumDetail}[],signal?:AbortSignal):Promise<StoredCompendiumDetail|undefined>{
 const incoming=batch??(value?[{key:key!,row:value}]:[])
 if(action==='write'&&(signal?.aborted||!incoming.length||incoming.length>COMPENDIUM_PRELOAD_LIMITS.batch||new Set(incoming.map(e=>e.key)).size!==incoming.length||incoming.some(e=>typeof e.key!=='string'||!e.row||e.row.owner!==incoming[0]!.row.owner||typeof e.row.payload!=='string'||e.row.payload.length>DETAIL_MAX_BYTES||new TextEncoder().encode(e.row.payload).length>DETAIL_MAX_BYTES)))return Promise.resolve(undefined)
 return new Promise(resolve=>{
  const current=generation
  let db:IDBDatabase|undefined,tx:IDBTransaction|undefined,settled=false,result:StoredCompendiumDetail|undefined
  const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(tx)writes.delete(tx);db?.close();resolve(result)}
  const abort=()=>{result=undefined;try{tx?.abort()}catch{/* Complete. */}finish()}
  const timer=setTimeout(()=>{result=undefined;try{tx?.abort()}catch{/* Complete. */}finish()},action==='read'?100:500)
  signal?.addEventListener('abort',abort,{once:true})
  try{
   const request=globalThis.indexedDB?.open('codex-compendium-details-v1',1)
   if(!request){finish();return}
   request.onupgradeneeded=()=>request.result.createObjectStore('entries')
   request.onerror=finish
   request.onsuccess=()=>{
    db=request.result
    if(settled||current!==generation&&action!=='clear'){db.close();finish();return}
    try{
     tx=db.transaction('entries',action==='read'?'readonly':'readwrite')
     const store=tx.objectStore('entries');if(action==='write')writes.add(tx)
     tx.oncomplete=finish;tx.onerror=tx.onabort=()=>{result=undefined;finish()}
     if(action==='read'){const get=store.get(key!);get.onsuccess=()=>{result=get.result};return}
     if(action==='clear'){store.clear();return}
     const now=Date.now(),keys=new Set(incoming.map(e=>e.key)),owner=incoming[0]!.row.owner,retained:{key:IDBValidKey;savedAt:number;bytes:number}[]=[],cursor=store.openCursor()
     cursor.onsuccess=()=>{try{
      if(settled||signal?.aborted)return
      const row=cursor.result
      if(row){
       const old=row.value,bytes=typeof old?.payload==='string'&&old.payload.length<=DETAIL_MAX_BYTES?new TextEncoder().encode(old.payload).length:Infinity
       if(keys.has(row.primaryKey as string)||old?.owner!==owner||!Number.isFinite(old?.savedAt)||old.savedAt<=now-DETAIL_LIFETIME||old.savedAt>now+60000||bytes>DETAIL_MAX_BYTES)row.delete()
       else retained.push({key:row.primaryKey,savedAt:old.savedAt,bytes})
       row.continue();return
      }
      let bytes=incoming.reduce((sum,e)=>sum+new TextEncoder().encode(e.row.payload).length,0)+retained.reduce((sum,row)=>sum+row.bytes,0),count=retained.length+incoming.length
      for(const old of retained.sort((a,b)=>a.savedAt-b.savedAt)){
       if(bytes<=DETAIL_TOTAL_BYTES&&count<=DETAIL_MAX_ENTRIES)break
       store.delete(old.key);bytes-=old.bytes;count--
      }
      for(const e of incoming)store.put(e.row,e.key)
     }catch{tx?.abort();finish()}}
    }catch{finish()}
   }
  }catch{finish()}
 })
}
export const compendiumDetailStorage:CompendiumDetailStorage={read:key=>operation('read',key),write:(key,value)=>operation('write',key,value),writeMany:(entries,signal)=>operation('write',undefined,undefined,entries,signal),clear:()=>operation('clear')}
