import {sheetReferenceCache,type SheetReferences} from './sheet-reference-cache'

export interface StoredSheetReferences {key:string;owner:string;expires:number;digest:string;payload:string}
export interface SheetReferenceStorage {
 read(key:string):Promise<StoredSheetReferences|undefined>
 write(value:StoredSheetReferences):Promise<unknown>
 clear():Promise<unknown>
}
export const SHEET_REFERENCE_DATABASE='codex-sheet-references-v1'
const lifetime=24*60*60*1000,budget=4*1024*1024,limit=24,marker='codex:sheet-references:reset'
let epoch=0
const writes=new Set<IDBTransaction>()
function identity(key:string){
 try{
  if(key.length>8192)return
  const [owner,path,role,version,revision]=JSON.parse(key)
  // Persist only the owner's ordinary sheet. Room access and preview responses
  // continue using the existing short session cache and live authorization.
  return typeof owner==='string'&&owner&&typeof path==='string'&&/^\/api\/characters\/[^/]+\/references$/.test(path)&&role==='owner'&&
   typeof version==='string'&&version&&typeof revision==='string'&&revision?{owner,id:path.split('/')[3],version}:undefined
 }catch{return undefined}
}
function operation(action:'read'|'write'|'clear',key?:string,value?:StoredSheetReferences):Promise<StoredSheetReferences|undefined>{
 return new Promise(resolve=>{
  let db:IDBDatabase|undefined,tx:IDBTransaction|undefined,result:StoredSheetReferences|undefined,settled=false
  const current=epoch
  const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);if(tx)writes.delete(tx);db?.close();resolve(result)}
  const timer=setTimeout(()=>{result=undefined;try{tx?.abort()}catch{/* Complete. */}finish()},action==='read'?100:500)
  try{
   const open=globalThis.indexedDB?.open(SHEET_REFERENCE_DATABASE,1)
   if(!open){finish();return}
   open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('references'))open.result.createObjectStore('references')}
   open.onerror=()=>finish()
   open.onsuccess=()=>{
    db=open.result
    if(settled||current!==epoch){db.close();finish();return}
    try{
     tx=db.transaction('references',action==='read'?'readonly':'readwrite')
     const store=tx.objectStore('references')
     if(action!=='read')writes.add(tx)
     tx.oncomplete=finish;tx.onerror=tx.onabort=()=>{result=undefined;finish()}
     if(action==='read'){const read=store.get(key!);read.onsuccess=()=>{result=read.result};return}
     if(action==='clear'){store.clear();return}
     const retained:{key:IDBValidKey;row:StoredSheetReferences;bytes:number}[]=[],now=Date.now(),next=identity(value!.key)!,scan=store.openCursor()
     scan.onsuccess=()=>{try{
      const cursor=scan.result
      if(cursor){
       const old=cursor.value,id=typeof old?.key==='string'?identity(old.key):undefined
       if(!id||old.owner!==value!.owner||id.owner!==value!.owner||id.id===next.id||!Number.isFinite(old.expires)||old.expires<=now||old.expires>now+lifetime||typeof old.payload!=='string'||old.payload.length>budget)cursor.delete()
       else retained.push({key:cursor.primaryKey,row:old,bytes:new TextEncoder().encode(old.payload).length})
       cursor.continue();return
      }
      let count=retained.length,bytes=new TextEncoder().encode(value!.payload).length+retained.reduce((n,item)=>n+item.bytes,0)
      for(const old of retained.sort((a,b)=>a.row.expires-b.row.expires)){
       if(bytes<=budget&&count<limit)break
       store.delete(old.key);bytes-=old.bytes;count--
      }
      store.put(value,value!.key)
     }catch{result=undefined;tx?.abort();finish()}}
    }catch{finish()}
   }
  }catch{finish()}
 })
}
export const sheetReferenceStorage:SheetReferenceStorage={read:key=>operation('read',key),write:value=>operation('write',value.key,value),clear:()=>operation('clear')}
function reset(notify:boolean){
 ++epoch;sheetReferenceCache.clear()
 for(const tx of writes)try{tx.abort()}catch{/* Complete. */}
 writes.clear()
 if(notify)try{localStorage.setItem(marker,crypto.randomUUID())}catch{/* Storage is optional. */}
}
export function clearPersistedSheetReferences(){reset(true);void sheetReferenceStorage.clear()}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===marker||event.key===null)reset(false)})
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function valid(value:unknown,key:string):value is SheetReferences{
 if(!record(value))return false
 const scope=identity(key),c=value.character
 if(!scope||!record(c)||c._id!==scope.id||c.updatedAt!==scope.version||c.externalImport!==undefined)return false
 if(!['meta','abilities','saves','skills','combat','spellcasting','personality','proficiencies'].every(k=>record(c[k]))||
  !['features','equipment','attacks'].every(k=>Array.isArray(c[k])))return false
 const casting=c.spellcasting as Record<string,unknown>,proficiencies=c.proficiencies as Record<string,unknown>
 if(!Array.isArray(casting.known)||!Array.isArray(casting.prepared)||!record(casting.slots)||
  !['armor','weapons','tools','languages'].every(k=>Array.isArray(proficiencies[k])))return false
 if(c.homebrew!==undefined&&(!record(c.homebrew)||!Array.isArray(c.homebrew.bindings)))return false
 return ['spells','feats','races','subclasses','classes','backgrounds'].every(k=>Array.isArray(value[k])&&value[k].every((row:unknown)=>record(row)&&typeof row.index==='string'&&typeof row.name==='string'))
}
async function checksum(payload:string){
 if(payload.length>budget)return undefined
 const bytes=new TextEncoder().encode(payload);if(bytes.length>budget)return undefined
 const hash=await crypto.subtle.digest('SHA-256',bytes)
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
}
/** The caller must first match this key against a fresh authorized quick read.
 * The whole optional disk/hash path adds at most 100 ms before server fallback. */
export async function readPersistedSheetReferences(key:string,expectedEpoch:number,storage:SheetReferenceStorage=sheetReferenceStorage):Promise<SheetReferences|undefined>{
 const scope=identity(key),current=epoch
 if(!scope||expectedEpoch!==sheetReferenceCache.epoch)return
 let timer:ReturnType<typeof setTimeout>|undefined
 try{
  return await Promise.race([(async()=>{
   const row=await storage.read(key),now=Date.now()
   if(!row||row.key!==key||row.owner!==scope.owner||!Number.isFinite(row.expires)||row.expires<=now||row.expires>now+lifetime||typeof row.digest!=='string'||!/^[a-f0-9]{64}$/.test(row.digest)||typeof row.payload!=='string'||await checksum(row.payload)!==row.digest)return
   const value:unknown=JSON.parse(row.payload)
   if(current===epoch&&expectedEpoch===sheetReferenceCache.epoch&&valid(value,key))return value
  })(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),100)})])
 }catch{return undefined}finally{clearTimeout(timer)}
}
export async function persistSheetReferences(key:string,value:SheetReferences,expectedEpoch:number,storage:SheetReferenceStorage=sheetReferenceStorage){
 const scope=identity(key),current=epoch
 if(!scope||expectedEpoch!==sheetReferenceCache.epoch)return
 try{
  const compact={...value,character:value.character?{...value.character,externalImport:undefined}:undefined}
  if(!valid(compact,key))return
  const payload=JSON.stringify(compact),digest=await checksum(payload)
  if(digest&&current===epoch&&expectedEpoch===sheetReferenceCache.epoch)await storage.write({key,owner:scope.owner,expires:Date.now()+lifetime,digest,payload})
 }catch{/* Quota, eviction and blocked storage fall back to live references. */}
}
