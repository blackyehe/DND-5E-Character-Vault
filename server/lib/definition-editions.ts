import mongoose, {type ClientSession} from 'mongoose'
import {CustomContent} from '../models/CustomContent'
import {ensureContentIndexes} from './content-indexes'
import {sourceHash} from './orcbrew'
import {applyEntryChanges,changedEntryFields,type CompendiumKind,type EntryData} from '../../shared/compendium-editing'

export class DefinitionConflict extends Error {status=409}
const conflict=()=>new DefinitionConflict('This definition changed in another editor. Your draft is kept; reopen the saved version before saving again.')
const object=(v:unknown)=>v&&typeof v==='object'?v as EntryData:{}
export const editIdentity=(kind:string,index:string)=>sourceHash(`${kind}:${index}`)
/** Fingerprinted pack indices change on every save. Native IDs do not. */
export function definitionIdentity(kind:CompendiumKind,index:string,source:EntryData){
 if(index.startsWith('workshop-item-'))return editIdentity('item',index)
 const native=object(source.workshop??object(source.details)[':codex/workshop'])
 const id=source.optionId??source.spellId??native.id
 return typeof id==='string'?editIdentity(kind,`native:${id}`):editIdentity(kind,index)
}
export function sameDefinition(d:{kind:CompendiumKind;index:string;entry:EntryData},kind:CompendiumKind,index:string,source:EntryData){
 return definitionIdentity(d.kind,d.index,d.entry)===definitionIdentity(kind,index,source)||d.kind===kind&&(d.index===index||Array.isArray(source.aliases)&&source.aliases.includes(d.index))
}
export function editionKeys(kind:CompendiumKind,index:string,source:EntryData){
 const previous=object(source.details)[':codex/previous-indexes']
 const aliases=[index,...(Array.isArray(source.aliases)?source.aliases:[]),...(Array.isArray(previous)?previous:[])]
 return [...new Set([definitionIdentity(kind,index,source),...aliases.filter((v):v is string=>typeof v==='string').flatMap(id=>index.startsWith('workshop-item-')?['equipment','magic-items'].map(k=>editIdentity(k,id)):[editIdentity(kind,id)])])]
}
export async function definitionEdition(owner:string|undefined,kind:CompendiumKind,index:string,source:EntryData,session?:ClientSession){
 const docs=await CustomContent.find({userId:owner,type:'compendium-edit',sourceHash:{$in:editionKeys(kind,index,source)}}).setOptions({session}).lean()
 return selectEdition(docs,kind,index,source)
}
function selectEdition<T extends {sourceHash?:string|null;updatedAt?:Date}>(docs:T[],kind:CompendiumKind,index:string,source:EntryData){
 const identity=definitionIdentity(kind,index,source)
 // Before stable IDs, each fingerprint could have its own edition. Adopt the
 // most recently saved one once; retain older records for recovery.
 return docs.find(d=>d.sourceHash===identity)??[...docs].sort((a,b)=>Number(b.updatedAt??0)-Number(a.updatedAt??0))[0]
}
export async function effectiveDefinitions(owner:string|undefined,rows:{kind:CompendiumKind;source:EntryData}[]){
 const keys=[...new Set(rows.flatMap(({kind,source})=>editionKeys(kind,String(source.index),source)))],docs=keys.length?await CustomContent.find({userId:owner,type:'compendium-edit',sourceHash:{$in:keys}}).lean():[]
 return rows.map(({kind,source})=>{
  const wanted=new Set(editionKeys(kind,String(source.index),source)),doc=selectEdition(docs.filter(d=>d.sourceHash&&wanted.has(d.sourceHash)),kind,String(source.index),source),data=doc?.data as {revision:number;changes:EntryData;before?:EntryData}|undefined
  return {entry:applyEntryChanges(source,data?.changes??{}),revision:data?.revision??0,previousSource:data?.before??source}
 })
}
export async function effectiveDefinition(owner:string|undefined,kind:CompendiumKind,source:EntryData){
 const doc=await definitionEdition(owner,kind,String(source.index),source)
 const data=doc?.data as {revision:number;changes:EntryData;before?:EntryData}|undefined
 return {entry:applyEntryChanges(source,data?.changes??{}),revision:data?.revision??0,previousSource:data?.before??source}
}
type SourceWrite<T>=(session:ClientSession)=>Promise<T|null>
/** Both editors touch the same source document and edition in one transaction.
 * A retry rechecks the original revision, rather than silently replaying a stale draft. */
export async function saveNativeDefinition<T>(owner:string|undefined,kind:CompendiumKind,before:EntryData|undefined,after:EntryData,expectedRevision:number,desired:EntryData,write:SourceWrite<T>){
 await ensureContentIndexes()
 return mongoose.connection.transaction(async session=>{
  const edition=await definitionEdition(owner,kind,String(before?.index??after.index),before??after,session)
  if((edition?.data?.revision??0)!==expectedRevision)throw conflict()
  const saved=await write(session);if(!saved)throw conflict()
  const data={kind,index:String(after.index),before:edition?.data?.before??before??after,revision:expectedRevision+1,sourceHash:sourceHash(JSON.stringify(after)),changes:changedEntryFields(after,desired)}
  const identity=definitionIdentity(kind,String(after.index),after)
  if(edition){if(!await CustomContent.findOneAndUpdate({_id:edition._id,userId:owner,'data.revision':expectedRevision},{$set:{data,sourceHash:identity}},{session,new:true}).lean())throw conflict()}
  else await CustomContent.create([{userId:owner,type:'compendium-edit',sourceHash:identity,data}],{session})
  return {saved,revision:data.revision}
 })
}
export async function savePersonalDefinition(owner:string|undefined,kind:CompendiumKind,index:string,source:EntryData,expectedRevision:number,entry:EntryData){
 await ensureContentIndexes()
 return mongoose.connection.transaction(async session=>{
  const edition=await definitionEdition(owner,kind,index,source,session)
  if((edition?.data?.revision??0)!==expectedRevision)throw conflict()
  await lockDefinitionSource(owner,kind,index,source,session)
  const data={kind,index,before:edition?.data?.before??source,revision:expectedRevision+1,sourceHash:sourceHash(JSON.stringify(source)),changes:changedEntryFields(source,entry)},identity=definitionIdentity(kind,index,source)
  if(edition){if(!await CustomContent.findOneAndUpdate({_id:edition._id,userId:owner,'data.revision':expectedRevision},{$set:{data,sourceHash:identity}},{session,new:true}).lean())throw conflict()}
  else await CustomContent.create([{userId:owner,type:'compendium-edit',sourceHash:identity,data}],{session})
  return data
 })
}

async function lockDefinitionSource(owner:string|undefined,kind:CompendiumKind,index:string,source:EntryData,session:ClientSession){
  // Writing the source fence makes a concurrent Workshop save conflict even
  // when this is the first personal edition and there is no edition row yet.
  if(index.startsWith('workshop-item-')){
   const id=index.slice('workshop-item-'.length),item=object(source.workshopItem)
   const doc=await CustomContent.findOne({_id:id,userId:owner,type:'item'}).session(session).lean()
   const {prepareItem}=await import('./inventory')
   const latest=doc?object(prepareItem(doc.data as import('../../shared/character').EquipmentItem)):{}
   if(!doc||![...new Set([...Object.keys(item),...Object.keys(latest)])].every(key=>JSON.stringify(item[key])===JSON.stringify(latest[key])))throw conflict()
   await CustomContent.updateOne({_id:id,userId:owner,type:'item'},{$inc:{definitionVersion:1}},{session,timestamps:false})
  }else if(index.startsWith('homebrew-')){
   const aliases=Array.isArray(source.aliases)?source.aliases:[]
   const ids=[...new Set(aliases.flatMap(alias=>typeof alias==='string'?alias.match(/^homebrew-([a-f0-9]{24})-/)?.[1]??[]:[]))]
   if(!ids.length)throw conflict()
   // Source signatures are checked again after acquiring the write fence below.
   const docs=await CustomContent.find({_id:{$in:ids},userId:owner,type:'orcbrew'}).select('_id sourceHash').session(session).lean()
   if(!docs.length)throw conflict()
   const {cachedParsedPack,parsedPack}=await import('./orcbrew-library')
   let found=false
   for(const doc of docs){let parsed=cachedParsedPack(doc.sourceHash)
    if(!parsed){const full=await CustomContent.findOne({_id:doc._id,userId:owner,type:'orcbrew'}).select('data').session(session).lean();if(full)parsed=parsedPack(full.data)}
    if(parsed?.entries[kind].some(e=>e.index===index)){found=true;break}
   }
   if(!found)throw conflict()
   await CustomContent.updateMany({_id:{$in:docs.map(doc=>doc._id)},userId:owner,type:'orcbrew'},{$inc:{definitionVersion:1}},{session,timestamps:false})
  }
}

export async function withCurrentDefinition<T>(owner:string|undefined,kind:CompendiumKind,index:string,source:EntryData,revision:number,write:SourceWrite<T>){
 await ensureContentIndexes()
 return mongoose.connection.transaction(async session=>{
  const edition=await definitionEdition(owner,kind,index,source,session)
  if((edition?.data?.revision??0)!==revision)throw conflict()
  await lockDefinitionSource(owner,kind,index,source,session)
  if(edition)await CustomContent.updateOne({_id:edition._id,userId:owner,'data.revision':revision},{$inc:{definitionVersion:1}},{session,timestamps:false})
  else await CustomContent.create([{userId:owner,type:'compendium-edit',sourceHash:definitionIdentity(kind,index,source),data:{kind,index,revision:0,sourceHash:sourceHash(JSON.stringify(source)),changes:{}}}],{session})
  const result=await write(session);if(!result)throw conflict();return result
 })
}
