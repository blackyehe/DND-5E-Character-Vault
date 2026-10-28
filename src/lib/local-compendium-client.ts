import {api} from './api'
import type {BrowseKind,BrowsePage,BrowseQuery} from '../../shared/compendium-browse'
import {LOCAL_COMPENDIUM_VERSION,type LocalCompendiumRevision,type LocalCompendiumSnapshot} from '../../shared/local-compendium'
import type {LocalWorkerCommand} from './local-compendium.worker'

// Saving stays explicit. A build can hide the optional controls with `false`.
export const localCompendiumEnabled=import.meta.env.VITE_LOCAL_COMPENDIUM!=='false'
let worker:Worker|undefined,sequence=0,generation=0
let unavailableUntil=0
let validated:{owner:string;kind:BrowseKind;revision:string;until:number}|undefined
const pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>()
const markerKey='codex:local-compendium:v1'
export type LocalCompendiumState='not-saved'|'saved'|'outdated'|'missing'
const ineligible=new Map<string,'outdated'|'missing'>()
const categoryKey=(owner:string,kind:BrowseKind)=>`${owner}:${kind}`
function rejectCategory(owner:string,kind:BrowseKind,state:'outdated'|'missing'){
 const key=categoryKey(owner,kind)
 ineligible.delete(key);ineligible.set(key,state)
 while(ineligible.size>15)ineligible.delete(ineligible.keys().next().value!)
}
export function localCompendiumState(owner:string,kind:BrowseKind):LocalCompendiumState{
 return savedKinds(owner).includes(kind)?ineligible.get(categoryKey(owner,kind))??'saved':'not-saved'
}
function savedKinds(owner:string):BrowseKind[]{
 try{const marker=JSON.parse(localStorage.getItem(markerKey)??'null');return marker?.owner===owner&&Array.isArray(marker.kinds)?marker.kinds:[]}catch{return []}
}
function stop(){
 ++generation;worker?.terminate();worker=undefined;validated=undefined
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Local catalogue operation cancelled'))}
 pending.clear()
}
// Account/logout/removal changes in another tab invalidate parsed device data
// immediately; the receiving tab never writes the marker back.
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===markerKey||event.key===null){ineligible.clear();unavailableUntil=0;stop()}})
export function clearLocalCompendium(){
 ineligible.clear();unavailableUntil=0;stop()
 try{localStorage.removeItem(markerKey)}catch{/* Storage is optional. */}
 // Do not import worker query/filter data into the application entry bundle.
 try{const request=indexedDB.deleteDatabase('codex-compendium-index-v1');request.onerror=()=>{}}catch{/* Storage is optional. */}
}
function request<T>(command:Omit<LocalWorkerCommand,'id'>):Promise<T>{
 if(!worker){
  worker=new Worker(new URL('./local-compendium.worker.ts',import.meta.url),{type:'module'})
  worker.onmessage=event=>{const p=pending.get(event.data.id);if(!p)return;pending.delete(event.data.id);clearTimeout(p.timer);event.data.error?p.reject(Error(event.data.error)):p.resolve(event.data.value)}
  worker.onerror=()=>stop()
 }
 const id=++sequence
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>stop(),command.action==='save'?10000:3000)
  pending.set(id,{resolve:v=>resolve(v as T),reject,timer});worker!.postMessage({...command,id})
 })
}
async function validate(owner:string,kind:BrowseKind,revision:string,signal?:AbortSignal){
 const current=generation
 const result=await api.get<LocalCompendiumRevision>(`/api/compendium-browse/${kind}/local-revision`,{signal,timeoutMs:5000})
 if(current!==generation||signal?.aborted||result.owner!==owner||result.version!==LOCAL_COMPENDIUM_VERSION)return false
 if(result.revision!==revision){rejectCategory(owner,kind,'outdated');validated=undefined;return false}
 validated={owner,kind,revision,until:Date.now()+30000};return true
}
export async function queryLocalCompendium(owner:string,kind:BrowseKind,query:BrowseQuery,signal:AbortSignal):Promise<BrowsePage|undefined>{
 // An absent hint skips worker download entirely on ordinary unsaved visits.
 // This hint never authorizes cached data: disk identity and server revision do.
 if(signal.aborted||Date.now()<unavailableUntil||!savedKinds(owner).includes(kind)||ineligible.has(categoryKey(owner,kind)))return
 const current=generation
 const controller=new AbortController(),localSignal=AbortSignal.any([signal,controller.signal])
 let timer:ReturnType<typeof setTimeout>|undefined,onAbort:()=>void=()=>{}
 const fallback=new Promise<undefined>(resolve=>{
  onAbort=()=>resolve(undefined)
  signal.addEventListener('abort',onAbort,{once:true})
  // Optional storage must not add its separate worker, disk and network
  // timeouts before ordinary browsing. Back off after a stalled attempt.
  timer=setTimeout(()=>{unavailableUntil=Date.now()+30000;controller.abort();stop();resolve(undefined)},1500)
 })
 const attempt=async()=>{try{
  const revision=await request<string|null>({action:'open',owner,kind})
  if(localSignal.aborted||current!==generation)return
  if(!revision){rejectCategory(owner,kind,'missing');return}
  if(!(validated?.owner===owner&&validated.kind===kind&&validated.revision===revision&&validated.until>Date.now())&&!await validate(owner,kind,revision,localSignal))return
  if(localSignal.aborted||current!==generation)return
  const result=await request<BrowsePage>({action:'query',owner,kind,revision,query})
  if(!localSignal.aborted&&current===generation)return result
 }catch{/* Disk, worker or revision failures use ordinary authenticated browsing. */}}
 try{return await Promise.race([attempt(),fallback])}
 finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort);controller.abort()}
}
/** Overlap a previously requested device index with the ordinary first page.
 * No speculative database/API read, no worker for users without saved data. */
export function prepareSavedCompendium(owner:string){
 const kind=savedKinds(owner).find(kind=>!ineligible.has(categoryKey(owner,kind)))
 try{if(kind)void request({action:'open',owner,kind}).catch(()=>{})}catch{/* Unsupported/blocked workers use server browsing. */}
}
export async function saveLocalCompendium(owner:string,kind:BrowseKind,signal:AbortSignal){
 const current=generation
 const snapshot=await api.get<LocalCompendiumSnapshot>(`/api/compendium-browse/${kind}/local-index`,{signal,timeoutMs:60000})
 if(signal.aborted||current!==generation)throw Error('Local download cancelled')
 const revision=await request<string>({action:'save',owner,kind,snapshot})
 if(signal.aborted||current!==generation)throw Error('Local download cancelled')
 if(!await validate(owner,kind,revision,signal))throw Error('Your library changed while saving. Please save this category again.')
 // A resave of the same kinds must still notify other tabs to reopen their copy.
 try{localStorage.setItem(markerKey,JSON.stringify({owner,kinds:[...new Set([...savedKinds(owner),kind])],update:crypto.randomUUID()}))}catch{throw Error('This browser could not enable local browsing. Server browsing remains available.')}
 ineligible.delete(categoryKey(owner,kind));unavailableUntil=0
}
export function invalidateLocalCompendium(){validated=undefined}
export function releaseLocalCompendium(){stop()}
