import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import {CustomContent} from '../models/CustomContent'
import {CompendiumEntryCache} from '../models/CompendiumEntryCache'
import {recoverableModelInitialization} from './model-initialization'
import {readPackDocuments} from './pack-source'
import {parsedPack} from './orcbrew-library'
import {buildOrcbrewCatalog} from './orcbrew'
import {activeWorkshopEntries} from './workshop-schema'
import type {BrowseEntry,BrowseKind} from '../../shared/compendium-browse'

const initialize=recoverableModelInitialization(()=>[CompendiumEntryCache])
const MAX_BYTES=4*1024*1024
const pending=new Map<string,Promise<BrowseEntry|null>>()
const digest=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
function binary(value:unknown):Buffer {
  if(value instanceof Uint8Array)return Buffer.from(value)
  const bson=value as {buffer?:Uint8Array;position?:number}|null
  if(bson?.buffer instanceof Uint8Array&&Number.isInteger(bson.position))return Buffer.from(bson.buffer.subarray(0,bson.position))
  throw new Error('Invalid source cache payload')
}
function decoded(doc:{payload?:unknown;digest?:unknown}|null,index:string):BrowseEntry|null {
  if(!doc)return null
  try {
    const data=binary(doc.payload)
    if(digest(data)!==doc.digest)return null
    const value=JSON.parse(gunzipSync(data,{maxOutputLength:MAX_BYTES}).toString('utf8')) as BrowseEntry
    return value.index===index&&typeof value.name==='string'&&value.homebrew===true?value:null
  }catch{return null}
}
/** Locate an exact fingerprint in one source pack, never assemble the account's
 * full library. The revisioned browse record proves current membership, carries
 * merged provenance and handles ambiguous/empty legacy aliases via filenames. */
export async function targetedCompendiumSource(userId:string,kind:BrowseKind,index:string,locator:BrowseEntry):Promise<BrowseEntry|null> {
  const names=Array.isArray(locator.sourcePacks)?locator.sourcePacks.filter((s):s is string=>typeof s==='string'):[]
  const aliases=Array.isArray(locator.aliases)?locator.aliases:[]
  const ids=[...new Set(aliases.flatMap(a=>typeof a==='string'?a.match(/^homebrew-([a-f0-9]{24})-/i)?.[1]??[]:[]))]
  if(!names.length&&!ids.length)return null
  const docs=await CustomContent.find({userId,type:'orcbrew',...(names.length?{'data.filename':{$in:names}}:{_id:{$in:ids}})}).select('_id').sort({_id:1}).lean()
  for(const doc of docs){
    const sources=await readPackDocuments(userId,String(doc._id))
    if(!sources.length)continue
    const pack=sources[0]!,data=pack.data as {filename:string;includeDisabled?:boolean}
    const catalog=buildOrcbrewCatalog([{id:String(pack._id),filename:data.filename,includeDisabled:data.includeDisabled,parsed:parsedPack(pack.data)}])
    const entries=kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(catalog[kind],kind):catalog[kind]
    const source=entries.find(e=>e.index===index)
    if(!source)continue
    const entry={...source} as unknown as BrowseEntry
    // Keep complete rules/workshop payloads; only restore the merged identity
    // metadata that a one-pack catalog cannot reconstruct from other copies.
    for(const key of ['source','sourcePack','sourcePacks','sources','aliases'])if(locator[key]!==undefined)entry[key]=locator[key]
    if(locator.name===source.name&&locator.displayName!==undefined)entry.displayName=locator.displayName
    return entry
  }
  return null
}
/** A source projection survives function cold starts; edits/enrichment are applied
 * separately so cached source can never replace the account's latest rules. */
export async function importedCompendiumSource(userId:string,kind:BrowseKind,index:string,revision:string,locate:()=>Promise<BrowseEntry|null>,resolvePrepared?:()=>Promise<BrowseEntry|null>):Promise<BrowseEntry|null> {
  const legacyFilter={userId,revision:`source-1:${revision}`,kind,index}
  const filter=resolvePrepared?{...legacyFilter,revision:`source-components-3-families:${revision}`}:legacyFilter,key=JSON.stringify(filter)
  const previous=pending.get(key);if(previous)return previous
  const task=(async()=>{
    try {
      if(resolvePrepared){
        const legacy=decoded(await CompendiumEntryCache.findOne({...legacyFilter,expiresAt:{$gt:new Date()}}).select('payload digest').lean(),index)
        if(legacy)return legacy
      }
      const cached=decoded(await CompendiumEntryCache.findOne({...filter,expiresAt:{$gt:new Date()}}).select('payload digest').lean(),index)
      if(cached)return cached
    }catch(error){console.warn('Compendium source cache read unavailable',{name:(error as Error).name})}
    // Prepared data shares the same revisioned, bounded base-source cache.
    // Personal changes and enrichment are applied by the returning caller.
    let entry=await resolvePrepared?.()
    if(!entry){
      const locator=await locate()
      if(!locator)return null
      entry=await targetedCompendiumSource(userId,kind,index,locator)
    }
    if(!entry)return null
    const json=JSON.stringify(entry)
    if(Buffer.byteLength(json)<=MAX_BYTES){
      try {
        const payload=gzipSync(json)
        await initialize()
        await CompendiumEntryCache.updateOne(filter,{$set:{payload,digest:digest(payload),expiresAt:new Date(Date.now()+7*86400000)}},{upsert:true})
      }catch(error){console.warn('Compendium source cache write unavailable',{name:(error as Error).name})}
    }
    return entry
  })()
  pending.set(key,task)
  try{return await task}finally{pending.delete(key)}
}
