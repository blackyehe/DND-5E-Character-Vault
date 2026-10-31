import {createHash} from 'node:crypto'
import type {BrowseKind} from '../../shared/compendium-browse'
import {COMPENDIUM_DETAIL_VERSION,type CompendiumDetailRevision} from '../../shared/compendium-details'
import {CustomContent} from '../models/CustomContent'
import {browseRevision,personalBrowseEntryAtRevision,BrowseRevisionChanged} from './compendium-browse'

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
