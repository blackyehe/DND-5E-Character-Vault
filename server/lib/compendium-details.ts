import {createHash} from 'node:crypto'
import type {BrowseKind} from '../../shared/compendium-browse'
import {COMPENDIUM_DETAIL_VERSION,COMPENDIUM_PRELOAD_LIMITS,type CompendiumDetailRevision,type CompendiumDetailBatch} from '../../shared/compendium-details'
import {CustomContent} from '../models/CustomContent'
import {browseRevision,personalBrowseEntryAtRevision,BrowseRevisionChanged,cachedBrowseIndex,preloadBrowseEntry,rememberValidatedBrowseIndex} from './compendium-browse'

async function detailRevisionState(owner:string,kind:BrowseKind){
 // Saved monster enrichment changes full details without changing browse rows.
 const [revision,supplements]=await Promise.all([browseRevision(owner),kind==='monsters'?CustomContent.find({userId:owner,type:'monster-enrichment',sourceHash:'active'}).select('_id updatedAt').sort({_id:1}).lean():[]])
 const identity:CompendiumDetailRevision={owner,kind,version:COMPENDIUM_DETAIL_VERSION,revision:createHash('sha256').update(JSON.stringify([COMPENDIUM_DETAIL_VERSION,kind,revision,supplements])).digest('hex')}
 return {revision,identity}
}
export async function compendiumDetailRevision(owner:string,kind:BrowseKind):Promise<CompendiumDetailRevision>{
 return (await detailRevisionState(owner,kind)).identity
}
export async function compendiumDetail(owner:string,kind:BrowseKind,index:string){
 for(let attempt=0;attempt<3;attempt++){
  const before=await detailRevisionState(owner,kind)
  try{
   // Reuse this request's captured revision instead of nesting another pair
   // of identical metadata reads inside the source reader.
   const entry=await personalBrowseEntryAtRevision(owner,kind,index,before.revision)
   const after=await detailRevisionState(owner,kind)
   if(before.identity.revision!==after.identity.revision)continue
   return entry?{...after.identity,index,entry}:null
  }catch(error){if(!(error instanceof BrowseRevisionChanged))throw error}
 }
 throw Error('Your library is changing. Please retry shortly.')
}
/** One stable owner/revision check around a small optional batch. No mutation
 * retries or source rebuilds: a changing/unprepared library waits for a click. */
export async function compendiumDetailBatch(owner:string,kind:BrowseKind,indexes:string[],bytes:number,aborted:()=>boolean=()=>false):Promise<CompendiumDetailBatch|null>{
 const limits=COMPENDIUM_PRELOAD_LIMITS
 if(!indexes.length||indexes.length>limits.batch||new Set(indexes).size!==indexes.length||indexes.some(i=>!i||i.length>limits.indexLength)||!Number.isSafeInteger(bytes)||bytes<1024||bytes>limits.batchBytes)throw Error('Invalid preload batch')
 const deadline=performance.now()+6000,before=await detailRevisionState(owner,kind)
 const entries:CompendiumDetailBatch['entries']=[]
 const result=()=>({...before.identity,entries,skipped:indexes.filter(i=>!entries.some(e=>e.index===i))})
 const catalogue=indexes.some(i=>i.startsWith('homebrew-'))&&!aborted()?await cachedBrowseIndex(owner,kind,before.revision):null
 for(const index of indexes){
  if(aborted()||performance.now()>deadline)break
  try{
   const entry=await preloadBrowseEntry(owner,kind,index,before.revision,catalogue?.records.find(r=>r.entry.index===index)?.entry)
   if(!entry||entry.index!==index||Buffer.byteLength(JSON.stringify(entry))>limits.entryBytes)continue
   entries.push({index,entry})
   if(Buffer.byteLength(JSON.stringify(result()))>bytes)entries.pop()
  }catch{/* Optional entry unavailable; its ordinary click retains the fallback. */}
 }
 if(aborted())return null
 const after=await detailRevisionState(owner,kind)
 if(before.identity.revision!==after.identity.revision||Buffer.byteLength(JSON.stringify(result()))>bytes)return null
 if(catalogue)rememberValidatedBrowseIndex(owner,kind,before.revision,catalogue)
 return result()
}
