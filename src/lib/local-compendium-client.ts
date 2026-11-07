import {reactive} from 'vue'
import {api} from './api'
import {beginForegroundWork} from './foreground-work'
import {BROWSE_KINDS,type BrowseKind} from '../../shared/compendium-kinds'
import type {BrowsePage,BrowseQuery} from '../../shared/compendium-browse'
import {LOCAL_COMPENDIUM_VERSION,type LocalCompendiumRevision,type LocalCompendiumSnapshot} from '../../shared/local-compendium'
import type {LocalWorkerCommand} from './local-compendium.worker'

export const localCompendiumEnabled=import.meta.env.VITE_LOCAL_COMPENDIUM!=='false'
export type LocalCompendiumState='not-saved'|'checking'|'saved'|'outdated'|'missing'|'downloading'|'unavailable'
export const localCategoryStates=reactive<Record<string,LocalCompendiumState>>({})
const key=(owner:string,kind:BrowseKind)=>`${owner}:${kind}`
const markerKey='codex:local-compendium:v1'
const listeners=new Set<()=>void>()
let generation=0,unavailableUntil=0
let validated:{owner:string;revision:string;until:number}|undefined
const changed=()=>{for(const listener of listeners)listener()}
export function onLocalCompendiumChange(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}}
export function savedLocalKinds(owner:string):BrowseKind[]{
 try{const marker=JSON.parse(localStorage.getItem(markerKey)??'null');return marker?.owner===owner&&Array.isArray(marker.kinds)?BROWSE_KINDS.filter(kind=>marker.kinds.includes(kind)):[]}catch{return []}
}
export function localCompendiumState(owner:string,kind:BrowseKind):LocalCompendiumState{
 return localCategoryStates[key(owner,kind)]??(savedLocalKinds(owner).includes(kind)?'checking':'not-saved')
}
export function setLocalCategoryState(owner:string,kind:BrowseKind,state:LocalCompendiumState){localCategoryStates[key(owner,kind)]=state}
class Channel {
 private worker?:Worker
 private sequence=0
 private pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;cleanup:()=>void}>()
 stop(){
  this.worker?.terminate();this.worker=undefined
  for(const p of this.pending.values()){p.cleanup();p.reject(Error('Local catalogue operation cancelled'))}
  this.pending.clear()
 }
 request<T>(command:Omit<LocalWorkerCommand,'id'>,signal?:AbortSignal):Promise<T>{
  if(signal?.aborted)return Promise.reject(Error('Local operation cancelled'))
  if(!this.worker){
   this.worker=new Worker(new URL('./local-compendium.worker.ts',import.meta.url),{type:'module'})
   this.worker.onmessage=event=>{const p=this.pending.get(event.data.id);if(!p)return;this.pending.delete(event.data.id);p.cleanup();event.data.error?p.reject(Error(event.data.error)):p.resolve(event.data.value)}
   this.worker.onerror=()=>this.stop()
  }
  const id=++this.sequence
  return new Promise((resolve,reject)=>{
   const abort=()=>this.stop()
   const timer=setTimeout(abort,command.action==='save'?10000:3000)
   const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
   this.pending.set(id,{resolve:v=>resolve(v as T),reject,cleanup})
   signal?.addEventListener('abort',abort,{once:true})
   try{this.worker!.postMessage({...command,id})}catch{this.stop()}
  })
 }
}
const browsing=new Channel(),maintenance=new Channel()
export function cancelLocalPreparation(){maintenance.stop()}
export function releaseLocalCompendium(){browsing.stop()}
function reset(){++generation;browsing.stop();maintenance.stop();validated=undefined;unavailableUntil=0;for(const id of Object.keys(localCategoryStates))delete localCategoryStates[id]}
export function suspendLocalCompendium(){reset();changed()}
export function adoptLocalCompendiumOwner(owner:string){
 try{const marker=JSON.parse(localStorage.getItem(markerKey)??'null');if(marker&&marker.owner!==owner){clearLocalCompendium();return}}catch{/* Invalid hints never authorize data. */}
 reset();changed()
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===markerKey||event.key===null){reset();changed()}})
export function clearLocalCompendium(){
 reset()
 try{localStorage.removeItem(markerKey)}catch{/* Optional storage. */}
 try{const request=indexedDB.deleteDatabase('codex-compendium-index-v1');request.onerror=()=>{}}catch{/* Optional storage. */}
 changed()
}
export function invalidateLocalCompendium(){validated=undefined;for(const id of Object.keys(localCategoryStates))if(localCategoryStates[id]==='saved')localCategoryStates[id]='checking';changed()}
export function acceptCompendiumRevision(owner:string,revision:string){
 if(!/^[a-f0-9]{64}$/.test(revision))return
 if(validated?.owner===owner&&validated.revision!==revision){
  for(const kind of BROWSE_KINDS)if(localCompendiumState(owner,kind)==='saved')setLocalCategoryState(owner,kind,'checking')
 }
 validated={owner,revision,until:Date.now()+30000}
}
async function currentRevision(owner:string,kind:BrowseKind,signal:AbortSignal,force=false,idle=false){
 if(!force&&validated?.owner===owner&&validated.until>Date.now())return validated.revision
 const current=generation
 const result=await api.get<LocalCompendiumRevision>(`/api/compendium-browse/${kind}/local-revision`,{signal,timeoutMs:5000,background:true,...(idle?{idle:true}:{})})
 if(current!==generation||signal.aborted||result.owner!==owner||result.version!==LOCAL_COMPENDIUM_VERSION||!/^[a-f0-9]{64}$/.test(result.revision))throw Error('Library validation unavailable')
 acceptCompendiumRevision(owner,result.revision)
 return result.revision
}
export async function queryLocalCompendium(owner:string,kind:BrowseKind,query:BrowseQuery,signal:AbortSignal):Promise<BrowsePage|undefined>{
 const state=localCompendiumState(owner,kind)
 if(signal.aborted||Date.now()<unavailableUntil||!savedLocalKinds(owner).includes(kind)||state==='missing'||state==='outdated'||state==='unavailable')return
 const finish=beginForegroundWork(),current=generation,controller=new AbortController()
 const localSignal=AbortSignal.any([signal,controller.signal])
 const timer=setTimeout(()=>{unavailableUntil=Date.now()+30000;controller.abort()},1500)
 let onAbort:()=>void=()=>{}
 const cancelled=new Promise<undefined>(resolve=>{onAbort=()=>resolve(undefined);localSignal.addEventListener('abort',onAbort,{once:true})})
 const attempt=async()=>{
 try{
  // Disk opening and authenticated revision validation overlap. The atomic browse
  // command reopens its own category before querying, even with concurrent pickers.
  const [disk,revision]=await Promise.all([browsing.request<string|null>({action:'open',owner,kind},localSignal),currentRevision(owner,kind,localSignal)])
  if(localSignal.aborted||current!==generation)return
  if(!disk||disk!==revision){setLocalCategoryState(owner,kind,disk?'outdated':'missing');changed();return}
  const result=await browsing.request<{revision:string|null;page?:BrowsePage}>({action:'browse',owner,kind,revision,query},localSignal)
  if(!localSignal.aborted&&current===generation&&result.page){setLocalCategoryState(owner,kind,'saved');return result.page}
 }catch{/* Optional disk, worker and metadata failures fall back to server browsing. */}
 }
 try{return await Promise.race([attempt(),cancelled])}
 finally{clearTimeout(timer);localSignal.removeEventListener('abort',onAbort);controller.abort();finish()}
}
export function prepareSavedCompendium(owner:string){
 const kind=savedLocalKinds(owner)[0]
 try{if(kind)void browsing.request({action:'open',owner,kind}).catch(()=>{})}catch{/* Workers may be blocked. */}
}
export async function checkSavedCompendium(owner:string,kind:BrowseKind,signal:AbortSignal){
 const current=generation
 const revision=await currentRevision(owner,kind,signal,false,true)
 const disk=await maintenance.request<string|null>({action:'open',owner,kind},signal)
 if(signal.aborted||current!==generation)throw Error('Local check cancelled')
 let valid=!!disk&&disk===revision
 if(disk&&!valid){
  const identity=await maintenance.request<{revision:string;digest:string}|null>({action:'identity',owner,kind},signal)
  if(identity&&identity.revision===disk){
   const content=await api.get<LocalCompendiumRevision&{kind?:string}>(`/api/compendium-browse/${kind}/local-revision?content=true`,{signal,timeoutMs:60000,background:true})
   if(signal.aborted||current!==generation)throw Error('Local check cancelled')
   if(content.owner!==owner||content.kind!==kind||content.version!==LOCAL_COMPENDIUM_VERSION||!/^[a-f0-9]{64}$/.test(content.revision)||!/^[a-f0-9]{64}$/.test(content.digest??''))throw Error('Category validation unavailable')
   if(content.digest===identity.digest){
    // As for a new export, reject a mutation during validation before writing.
    if(await currentRevision(owner,kind,signal,true,true)!==content.revision)throw Error('Library changed during category validation')
    if(signal.aborted||current!==generation)throw Error('Local check cancelled')
    const result=await maintenance.request<{revision:string|null;kinds?:BrowseKind[]}>({action:'revalidate',owner,kind,previous:disk,digest:identity.digest,revision:content.revision},signal)
    if(signal.aborted||current!==generation)throw Error('Local check cancelled')
    valid=result.revision===content.revision
    if(valid){
     const before=savedLocalKinds(owner),kinds=result.kinds??[...new Set([...before,kind])]
     localStorage.setItem(markerKey,JSON.stringify({owner,kinds,update:crypto.randomUUID()}))
     for(const old of before)if(!kinds.includes(old))setLocalCategoryState(owner,old,'unavailable')
     browsing.stop();changed()
    }
   }
  }
 }
 // An interrupted download may have committed to IndexedDB before its marker
 // was written. Reuse that verified copy instead of exporting it again.
 if(valid&&!savedLocalKinds(owner).includes(kind)){
  localStorage.setItem(markerKey,JSON.stringify({owner,kinds:[...savedLocalKinds(owner),kind],update:crypto.randomUUID()}))
 }
 setLocalCategoryState(owner,kind,valid?'saved':disk?'outdated':'missing')
 return valid
}
export async function saveLocalCompendium(owner:string,kind:BrowseKind,signal:AbortSignal){
 const current=generation
 const snapshot=await api.get<LocalCompendiumSnapshot>(`/api/compendium-browse/${kind}/local-index`,{signal,timeoutMs:60000,background:true})
 if(signal.aborted||current!==generation)throw Error('Local download cancelled')
 const result=await maintenance.request<{revision:string;kinds?:BrowseKind[]}>({action:'save',owner,kind,snapshot},signal)
 if(signal.aborted||current!==generation)throw Error('Local download cancelled')
 // A forced post-export read detects mutations during the download/write.
 if(await currentRevision(owner,kind,signal,true,true)!==result.revision)throw Error('Library changed while preparing this category')
 if(signal.aborted||current!==generation)throw Error('Local download cancelled')
 const before=savedLocalKinds(owner),kinds=result.kinds??[...new Set([...before,kind])]
 try{localStorage.setItem(markerKey,JSON.stringify({owner,kinds,update:crypto.randomUUID()}))}catch{throw Error('Local storage unavailable')}
 for(const old of before)if(!kinds.includes(old))setLocalCategoryState(owner,old,'unavailable')
 setLocalCategoryState(owner,kind,'saved');unavailableUntil=0
 // A separate browsing worker may hold the previous version in memory.
 browsing.stop();changed()
}
