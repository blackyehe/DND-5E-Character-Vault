import { ApiError } from './api'
import type { CreationOptions } from './srd'

interface StoredOptions {owner:string;etag:string;expires:number;digest:string;value:CreationOptions}
export interface CreationOptionsStorage {
 read():Promise<StoredOptions|undefined>
 write(value:StoredOptions):Promise<unknown>
 clear():Promise<unknown>
}
const lifetime=24*60*60*1000,maxBytes=8*1024*1024
const kinds=['classes','races','backgrounds','subraces','subclasses','feats','languages','spells'] as const
// Compression proxies may weaken an otherwise identical revision tag.
const revisionTag=(tag:string|null)=>tag&&/^(?:W\/)?"[a-f0-9]{64}"$/.test(tag)?tag.replace(/^W\//,''):undefined
let epoch=0
const writes=new Set<IDBTransaction>()

/** One bounded account-scoped catalogue, asynchronously stored. Blocked/quota/
 * private-mode failures fall back to a normal authenticated network request. */
function storageOperation(mode:IDBTransactionMode,action:'read'|'write'|'clear',value?:StoredOptions):Promise<StoredOptions|undefined>{
 return new Promise(resolve=>{
  let db:IDBDatabase|undefined,transaction:IDBTransaction|undefined,settled=false,result:StoredOptions|undefined
  const current=epoch
  const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);if(transaction)writes.delete(transaction);db?.close();resolve(result)}
  const timer=setTimeout(()=>{result=undefined;try{transaction?.abort()}catch{/* Already complete. */}finish()},action==='read'?100:500)
  try{
   const open=globalThis.indexedDB?.open('codex-creation-options-v1',1)
   if(!open){finish();return}
   open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('options'))open.result.createObjectStore('options')}
   open.onerror=()=>finish()
   open.onsuccess=()=>{
    db=open.result
    if(settled||current!==epoch){db.close();finish();return}
    try{
     transaction=db.transaction('options',mode)
     const store=transaction.objectStore('options')
     if(mode==='readwrite')writes.add(transaction)
     const request=action==='read'?store.get('current'):action==='write'?store.put(value,'current'):store.clear()
     request.onsuccess=()=>{if(action==='read')result=request.result as StoredOptions|undefined}
     transaction.oncomplete=finish
     transaction.onerror=transaction.onabort=()=>{result=undefined;finish()}
    }catch{finish()}
   }
  }catch{finish()}
 })
}
export const creationOptionsStorage:CreationOptionsStorage={
 read:()=>storageOperation('readonly','read'),
 write:value=>storageOperation('readwrite','write',value),
 clear:()=>storageOperation('readwrite','clear'),
}
export function clearCreationOptionsCache(){
 ++epoch
 for(const transaction of writes)try{transaction.abort()}catch{/* Already complete. */}
 writes.clear()
 void creationOptionsStorage.clear()
}
function valid(value:unknown):value is CreationOptions {
 if(!value||typeof value!=='object')return false
 const data=value as Record<string,unknown>
 return kinds.every(kind=>Array.isArray(data[kind])&&data[kind].every(entry=>entry&&typeof entry==='object'&&typeof entry.index==='string'&&typeof entry.name==='string'))
}
async function checksum(value:CreationOptions){
 const bytes=new TextEncoder().encode(JSON.stringify(value))
 if(bytes.length>maxBytes)return undefined
 const hash=await crypto.subtle.digest('SHA-256',bytes)
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
}
async function persist(owner:string,etag:string,value:CreationOptions,current:number,storage:CreationOptionsStorage){
 try{
  if(current!==epoch)return
  const digest=await checksum(value)
  if(digest&&current===epoch)await storage.write({owner,etag,expires:Date.now()+lifetime,digest,value})
 }catch{/* Quota or blocked storage must not prevent character creation. */}
}
export async function loadCreationOptions(owner:string|undefined,force=false,storage:CreationOptionsStorage=creationOptionsStorage):Promise<CreationOptions>{
 const current=epoch
 let cached:StoredOptions|undefined
 if(owner&&!force)try{
  const entry=await storage.read()
  if(entry?.owner===owner&&entry.expires>Date.now()&&revisionTag(entry.etag)&&valid(entry.value)&&await checksum(entry.value)===entry.digest)cached=entry
 }catch{/* Storage is optional. */}
 const response=await fetch('/api/content/creation-options',{
  credentials:'include',cache:'no-store',signal:AbortSignal.timeout(30000),
  headers:{'Content-Type':'application/json',...(cached?{'X-Creation-Revision':cached.etag}:{})},
 })
 if(response.status===304&&cached&&revisionTag(response.headers.get('ETag'))===revisionTag(cached.etag)){
  if(current!==epoch)throw Error('Your account changed while loading. Please retry the library.')
  return cached.value
 }
 if(!response.ok){
  let message=response.statusText
  try{message=(await response.json()).error||message}catch{/* Keep the HTTP error. */}
  throw new ApiError(response.status,message)
 }
 const value:unknown=await response.json()
 if(!valid(value))throw Error('Character options could not be read. Please retry the library.')
 const etag=response.headers.get('ETag')
 if(current!==epoch)throw Error('Your account changed while loading. Please retry the library.')
 // Optional hashing and disk writes run after returning the usable response.
 if(owner&&etag&&revisionTag(etag))setTimeout(()=>{void persist(owner,etag,value,current,storage)},0)
 return value
}
