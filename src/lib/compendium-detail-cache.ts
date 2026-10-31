import type {BrowseEntry,BrowseKind} from '../../shared/compendium-browse'
import {COMPENDIUM_DETAIL_VERSION,type CompendiumDetailResponse,type CompendiumDetailRevision} from '../../shared/compendium-details'
import {api} from './api'
import {beginForegroundWork} from './foreground-work'
import {compendiumDetailStorage,suspendCompendiumDetailStorage,DETAIL_LIFETIME,DETAIL_MAX_BYTES,type CompendiumDetailStorage,type StoredCompendiumDetail} from './compendium-detail-storage'

const marker='codex:compendium-detail-owner'
let epoch=0,activeOwner=''
const revisions=new Map<BrowseKind,{value:CompendiumDetailRevision;until:number}>()
const memory=new Map<string,StoredCompendiumDetail>()
function reset(){++epoch;revisions.clear();memory.clear();suspendCompendiumDetailStorage()}
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
 while(memory.size>20||[...memory.values()].reduce((sum,r)=>sum+r.payload.length*2,0)>4*1024*1024)memory.delete(memory.keys().next().value!)
}
function rememberRevision(value:CompendiumDetailRevision){revisions.set(value.kind,{value:{owner:value.owner,kind:value.kind,version:value.version,revision:value.revision},until:Date.now()+30000})}
async function read(key:string,storage:CompendiumDetailStorage){
 let timer:ReturnType<typeof setTimeout>|undefined
 try{return await Promise.race([storage.read(key),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),100)})])}catch{return undefined}finally{clearTimeout(timer)}
}
/** Only the signed-in owner's personal Compendium endpoint is eligible. Room,
 * player and character responses never enter this cache. No offline authority. */
export async function loadCompendiumDetail(owner:string,kind:BrowseKind,index:string,storage:CompendiumDetailStorage=compendiumDetailStorage):Promise<BrowseEntry>{
 const finish=beginForegroundWork(),current=epoch,key=identity(owner,kind,index)
 try{
  assertCurrent(owner,current)
  const stored=memory.get(key)??await read(key,storage)
  assertCurrent(owner,current)
  if(stored&&validRevision(stored,owner,kind)&&stored.index===index&&Number.isFinite(stored.savedAt)&&stored.savedAt>Date.now()-DETAIL_LIFETIME&&stored.savedAt<=Date.now()+60000&&typeof stored.payload==='string'&&typeof stored.digest==='string'&&await digest(stored.payload)===stored.digest){
   let entry:unknown
   try{entry=JSON.parse(stored.payload)}catch{/* Repair with an authorized fetch. */}
   if(validEntry(entry,index)){
    const recent=revisions.get(kind)
    const revision=recent&&recent.until>Date.now()?recent.value:await api.get<CompendiumDetailRevision>(`/api/compendium-browse/${kind}/detail-revision`,{timeoutMs:5000})
    assertCurrent(owner,current)
    if(!validRevision(revision,owner,kind))throw Error('Entry validation unavailable. Please retry.')
    rememberRevision(revision)
    if(revision.revision===stored.revision){remember(key,stored);return entry}
   }
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
   void Promise.resolve().then(()=>{assertCurrent(owner,current);return storage.write(key,row)}).catch(()=>{/* Optional quota/blocked storage. */})
  }
  return response.entry
 }finally{finish()}
}
