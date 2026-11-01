import type {BrowseEntry,BrowseKind} from '../../shared/compendium-browse'
import {COMPENDIUM_DETAIL_VERSION,COMPENDIUM_PRELOAD_LIMITS,type CompendiumDetailResponse,type CompendiumDetailRevision,type CompendiumDetailBatch} from '../../shared/compendium-details'
import {api} from './api'
import {beginForegroundWork} from './foreground-work'
import {compendiumDetailStorage,suspendCompendiumDetailStorage,DETAIL_LIFETIME,DETAIL_MAX_BYTES,type CompendiumDetailStorage,type StoredCompendiumDetail} from './compendium-detail-storage'

const marker='codex:compendium-detail-owner'
let epoch=0,activeOwner=''
const revisions=new Map<BrowseKind,{value:CompendiumDetailRevision;until:number}>()
const memory=new Map<string,StoredCompendiumDetail>()
const warmed=new Set<string>(),resetListeners=new Set<()=>void>()
interface PendingBatch {promise:Promise<void>;controller:AbortController;promoted:boolean}
const pendingPreloads=new Map<string,PendingBatch>()
function reset(){++epoch;for(const batch of new Set(pendingPreloads.values()))batch.controller.abort();pendingPreloads.clear();warmed.clear();revisions.clear();memory.clear();suspendCompendiumDetailStorage();for(const listener of resetListeners)listener()}
export function onCompendiumDetailsReset(listener:()=>void){resetListeners.add(listener);return ()=>{resetListeners.delete(listener)}}
export function suspendCompendiumDetails(){reset();activeOwner=''}
export function clearCompendiumDetails(){suspendCompendiumDetails();try{localStorage.removeItem(marker)}catch{/* Optional. */}void compendiumDetailStorage.clear()}
export function adoptCompendiumDetails(owner:string){
 reset()
 try{const previous=localStorage.getItem(marker);if(previous&&previous!==owner)void compendiumDetailStorage.clear();localStorage.setItem(marker,owner)}catch{/* Every read still checks its owner. */}
 activeOwner=owner
}
if(typeof window!=='undefined'){
 window.addEventListener('codex:library-changed',reset)
 window.addEventListener('storage',event=>{if(event.key===null||event.key===marker&&event.newValue!==activeOwner)suspendCompendiumDetails()})
}
const validRevision=(value:CompendiumDetailRevision,owner:string,kind:BrowseKind)=>value?.owner===owner&&value.kind===kind&&value.version===COMPENDIUM_DETAIL_VERSION&&/^[a-f0-9]{64}$/.test(value.revision)
const validEntry=(value:unknown,index:string):value is BrowseEntry=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(value as BrowseEntry).index===index&&typeof (value as BrowseEntry).name==='string'&&typeof (value as BrowseEntry).url==='string'
const identity=(owner:string,kind:BrowseKind,index:string)=>JSON.stringify([owner,kind,index])
async function digest(payload:string){
 try{
 if(payload.length>DETAIL_MAX_BYTES)return
 const bytes=new TextEncoder().encode(payload);if(bytes.length>DETAIL_MAX_BYTES)return
 const hash=await crypto.subtle.digest('SHA-256',bytes)
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
 }catch{return undefined}
}
function assertCurrent(owner:string,current:number){if(!owner||current!==epoch||activeOwner!==owner)throw Error('Your library or account changed. Please select the entry again.')}
function remember(key:string,row:StoredCompendiumDetail){
 memory.delete(key);memory.set(key,row)
 while(memory.size>32||[...memory.values()].reduce((sum,r)=>sum+r.payload.length*2,0)>4*1024*1024){const oldest=memory.keys().next().value!;memory.delete(oldest);warmed.delete(oldest)}
}
function rememberRevision(value:CompendiumDetailRevision){revisions.set(value.kind,{value:{owner:value.owner,kind:value.kind,version:value.version,revision:value.revision},until:Date.now()+30000})}
async function read(key:string,storage:CompendiumDetailStorage){
 let timer:ReturnType<typeof setTimeout>|undefined
 try{return await Promise.race([storage.read(key),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),100)})])}catch{return undefined}finally{clearTimeout(timer)}
}
async function checkedEntry(stored:StoredCompendiumDetail|undefined,owner:string,kind:BrowseKind,index:string):Promise<BrowseEntry|undefined>{
 if(!stored||!validRevision(stored,owner,kind)||stored.index!==index||!Number.isFinite(stored.savedAt)||stored.savedAt<=Date.now()-DETAIL_LIFETIME||stored.savedAt>Date.now()+60000||typeof stored.payload!=='string'||typeof stored.digest!=='string'||await digest(stored.payload)!==stored.digest)return
 try{const entry:unknown=JSON.parse(stored.payload);return validEntry(entry,index)?entry:undefined}catch{return}
}
function persist(owner:string,current:number,key:string,row:StoredCompendiumDetail,storage:CompendiumDetailStorage){
 void Promise.resolve().then(()=>{assertCurrent(owner,current);return storage.write(key,row)}).catch(()=>{/* Optional quota/blocked storage. */})
}
/** Only the signed-in owner's personal Compendium endpoint is eligible. Room,
 * player and character responses never enter this cache. No offline authority. */
export async function loadCompendiumDetail(owner:string,kind:BrowseKind,index:string,storage:CompendiumDetailStorage=compendiumDetailStorage):Promise<BrowseEntry>{
 const pending=pendingPreloads.get(identity(owner,kind,index));if(pending)pending.promoted=true
 const finish=beginForegroundWork(),current=epoch,key=identity(owner,kind,index)
 try{
  assertCurrent(owner,current)
  if(pending){
   // A click may reuse an almost-ready batch, but must never wait for its slow
   // siblings. It gets a short grace, then the ordinary detail request wins.
   let timer:ReturnType<typeof setTimeout>|undefined
   try{await Promise.race([pending.promise.catch(()=>{}),new Promise<void>(resolve=>{timer=setTimeout(resolve,COMPENDIUM_PRELOAD_LIMITS.joinMs)})])}finally{clearTimeout(timer);pending.controller.abort()}
   assertCurrent(owner,current)
  }
  const stored=memory.get(key)??await read(key,storage)
  assertCurrent(owner,current)
  const entry=await checkedEntry(stored,owner,kind,index)
  if(stored&&entry){
    const recent=revisions.get(kind)
    const revision=recent&&recent.until>Date.now()?recent.value:await api.get<CompendiumDetailRevision>(`/api/compendium-browse/${kind}/detail-revision`,{timeoutMs:5000})
    assertCurrent(owner,current)
    if(!validRevision(revision,owner,kind))throw Error('Entry validation unavailable. Please retry.')
    rememberRevision(revision)
    if(revision.revision===stored.revision){remember(key,stored);if(warmed.delete(key))persist(owner,current,key,stored,storage);return entry}
  }
  const response=await api.get<CompendiumDetailResponse>(`/api/compendium-browse/${kind}/saved-detail/${encodeURIComponent(index)}`,{timeoutMs:60000})
  assertCurrent(owner,current)
  if(!validRevision(response,owner,kind)||response.index!==index||!validEntry(response.entry,index))throw Error('The entry changed. Refresh the library and try again.')
  rememberRevision(response)
  const payload=JSON.stringify(response.entry),checksum=await digest(payload)
  assertCurrent(owner,current)
  if(checksum){
   const row:StoredCompendiumDetail={owner,kind,index,version:COMPENDIUM_DETAIL_VERSION,revision:response.revision,digest:checksum,payload,savedAt:Date.now()}
   remember(key,row)
   warmed.delete(key);persist(owner,current,key,row,storage)
  }
  return response.entry
 }finally{finish()}
}
/** Warm only a small visible batch in memory. Unopened entries never write to
 * IndexedDB; a normal open persists them through the same checked cache. */
export async function preloadCompendiumDetails(owner:string,kind:BrowseKind,indexes:string[],signal:AbortSignal,budget:number,storage:CompendiumDetailStorage=compendiumDetailStorage):Promise<number>{
 const limits=COMPENDIUM_PRELOAD_LIMITS,current=epoch
 if(signal.aborted||!indexes.length||indexes.length>limits.batch||new Set(indexes).size!==indexes.length||indexes.some(i=>!i||i.length>limits.indexLength)||budget<1024)return 0
 assertCurrent(owner,current)
 const batch:PendingBatch={promise:Promise.resolve(),controller:new AbortController(),promoted:false}
 const cancel=()=>{if(!batch.promoted)batch.controller.abort()};signal.addEventListener('abort',cancel,{once:true})
 let downloaded=0
 const check=()=>{assertCurrent(owner,current);if(batch.controller.signal.aborted)throw Error('Preload cancelled')}
 batch.promise=(async()=>{
  const missing:string[]=[];let revision=revisions.get(kind)
  for(const index of indexes){
   check();const key=identity(owner,kind,index),stored=memory.get(key)??await read(key,storage),entry=await checkedEntry(stored,owner,kind,index);check()
   if(stored&&entry){
    if(!revision||revision.until<=Date.now()){
     const value=await api.get<CompendiumDetailRevision>(`/api/compendium-browse/${kind}/detail-revision`,{background:true,signal:batch.controller.signal,timeoutMs:5000});check()
     if(!validRevision(value,owner,kind))throw Error('Invalid preload revision')
     downloaded+=new TextEncoder().encode(JSON.stringify(value)).length
     rememberRevision(value);revision=revisions.get(kind)
    }
    if(revision?.value.revision===stored.revision){remember(key,stored);continue}
   }
   missing.push(index)
  }
  if(!missing.length)return
  const bytes=Math.min(limits.batchBytes,Math.floor(budget)-downloaded)
  if(bytes<1024)return
  const params=new URLSearchParams({indexes:JSON.stringify(missing),bytes:String(bytes)})
  const authorizedAtRequest=revisions.get(kind)?.value.revision
  const response=await api.get<CompendiumDetailBatch>(`/api/compendium-browse/${kind}/detail-batch?${params}`,{background:true,signal:batch.controller.signal,timeoutMs:limits.requestMs});check()
  const checkAuthorization=()=>{const latest=revisions.get(kind)?.value.revision;if(latest&&latest!==authorizedAtRequest&&latest!==response.revision)throw Error('Preload was superseded by a newer foreground validation')}
  const responseBytes=new TextEncoder().encode(JSON.stringify(response)).length;downloaded+=responseBytes
  if(responseBytes>bytes||!validRevision(response,owner,kind)||!Array.isArray(response.entries)||response.entries.length>missing.length||!Array.isArray(response.skipped))throw Error('Invalid preload response')
  const seen=new Set<string>(),accepted:{key:string;row:StoredCompendiumDetail}[]=[]
  for(const value of response.entries){
   if(!missing.includes(value.index)||seen.has(value.index)||!validEntry(value.entry,value.index))throw Error('Invalid preload entry')
   seen.add(value.index);const payload=JSON.stringify(value.entry)
   if(new TextEncoder().encode(payload).length>limits.entryBytes)throw Error('Oversized preload entry')
   const checksum=await digest(payload);check()
   if(checksum)accepted.push({key:identity(owner,kind,value.index),row:{owner,kind,index:value.index,version:COMPENDIUM_DETAIL_VERSION,revision:response.revision,digest:checksum,payload,savedAt:Date.now()}})
  }
  if(response.skipped.some(i=>!missing.includes(i)||seen.has(i))||new Set([...seen,...response.skipped]).size!==missing.length||seen.size+response.skipped.length!==missing.length)throw Error('Invalid preload completion')
  check();checkAuthorization();rememberRevision(response)
  for(const value of accepted){remember(value.key,value.row);warmed.add(value.key)}
 })()
 for(const index of indexes)pendingPreloads.set(identity(owner,kind,index),batch)
 try{await batch.promise;return downloaded}finally{signal.removeEventListener('abort',cancel);for(const index of indexes){const key=identity(owner,kind,index);if(pendingPreloads.get(key)===batch)pendingPreloads.delete(key)}}
}
