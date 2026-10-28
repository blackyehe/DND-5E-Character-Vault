import type {BrowseKind} from '../../shared/compendium-browse'
import {LOCAL_CATEGORY_BYTES,LOCAL_TOTAL_BYTES,type StoredCompendiumSnapshot} from '../../shared/local-compendium'
import type {LocalIndexStorage} from './local-compendium-engine'

export const LOCAL_INDEX_DATABASE='codex-compendium-index-v1'
function operation(kind:BrowseKind,value?:StoredCompendiumSnapshot):Promise<StoredCompendiumSnapshot|undefined>{
 return new Promise((resolve,reject)=>{
  let db:IDBDatabase|undefined,tx:IDBTransaction|undefined,settled=false,result:StoredCompendiumSnapshot|undefined
  const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);db?.close();error?reject(error):resolve(result)}
  const timer=setTimeout(()=>{try{tx?.abort()}catch{/* Complete. */}finish(Error('Local catalogue storage timed out'))},2000)
  try{
   const open=indexedDB.open(LOCAL_INDEX_DATABASE,1)
   open.onupgradeneeded=()=>open.result.createObjectStore('categories',{keyPath:'kind'})
   open.onerror=()=>finish(Error('Local catalogue storage unavailable'))
   open.onsuccess=()=>{
    db=open.result
    if(settled){db.close();return}
    try{
     tx=db.transaction('categories',value?'readwrite':'readonly')
     const store=tx.objectStore('categories')
     tx.oncomplete=()=>finish();tx.onerror=tx.onabort=()=>finish(Error('Could not save the local catalogue'))
     if(!value){const read=store.get(kind);read.onsuccess=()=>{result=read.result};return}
     const all=store.getAll()
     all.onsuccess=()=>{
      const retained:StoredCompendiumSnapshot[]=[]
      for(const old of all.result as StoredCompendiumSnapshot[]){
       const bytes=typeof old.payload==='string'?new TextEncoder().encode(old.payload).length:Infinity
       if(old.owner!==value.owner||old.kind===kind||bytes>LOCAL_CATEGORY_BYTES||!Number.isFinite(old.savedAt))store.delete(old.kind)
       else retained.push({...old,bytes})
      }
      let bytes=retained.reduce((n,s)=>n+s.bytes,0)+value.bytes
      for(const old of retained.sort((a,b)=>a.savedAt-b.savedAt)){if(bytes<=LOCAL_TOTAL_BYTES)break;store.delete(old.kind);bytes-=old.bytes}
      store.put(value)
     }
    }catch(error){finish(error)}
   }
  }catch(error){finish(error)}
 })
}
export const localCompendiumStorage:LocalIndexStorage={read:kind=>operation(kind),write:async value=>{await operation(value.kind,value)}}
