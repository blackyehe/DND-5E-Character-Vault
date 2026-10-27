import { subclassParent } from '../../shared/subclass-identity'
import { compendiumFamilyContext } from '../../shared/compendium-family'
import { CustomContent } from '../models/CustomContent'
import { CompendiumBrowseIndex } from '../models/CompendiumBrowseIndex'
import { recoverableModelInitialization } from './model-initialization'
import { localSrdRule } from './srd-snapshot'
import { readSrdRule } from './srd-client'
import { env } from '../env'
import { workshopLibrary } from './workshop-library'
import { activeWorkshopEntries } from './workshop-schema'
import { monsterBrowseEntry } from './monster-browse'
import { enrichedMonsterEntries, enrichedStandardMonster } from './monster-enrichment'
import { prepareItem } from './inventory'
import { sourceHash, type OrcbrewEntry } from './orcbrew'
import type { EquipmentItem } from '../../shared/character'
import { browseIndex, browseRecord, type BrowseEntry, type BrowseIndex, type BrowseKind } from '../../shared/compendium-browse'
import { decodeBrowseIndex, encodeBrowseIndex, type IndexChunk } from './compendium-browse-storage'
import { importedCompendiumSource } from './compendium-entry-source'
import { readPreparedIndex, readPreparedSource, preparedReaderEnabled, type PreparedProbeContext } from './compendium-prepared'

// Bump when snapshot data, projection, grouping, filter or search semantics change.
const INDEX_VERSION='compendium-browse-2-families'
// Experimental derived data never occupies keys read by the baseline release.
export const preparedIndexRevision=(revision:string)=>`components-3-families:${revision}`
const memory=new Map<string,BrowseIndex>()
type IndexLoad={index:BrowseIndex;origin:'memory'|'legacy'|'prepared'|'prepared-stored'|'built'}
const pending=new Map<string,Promise<IndexLoad>>()
const initialize=recoverableModelInitialization(()=>[CompendiumBrowseIndex])

export async function browseRevision(userId:string) {
  // Read optional personal-edition documents even on releases where their editor
  // has not yet extended the CustomContent discriminator enum. No editions are written here.
  const filter:Record<string,unknown>={userId,type:{$in:['orcbrew','item','compendium-edit']}}
  const docs=await CustomContent.find(filter).select('_id type updatedAt sourceHash data.includeDisabled').sort({_id:1}).lean()
  return sourceHash(INDEX_VERSION+JSON.stringify(docs))
}
function remember(key:string,index:BrowseIndex) {
  memory.delete(key);memory.set(key,index)
  // Bound retained metadata across users and categories; full sources are separate.
  while(memory.size>8)memory.delete(memory.keys().next().value!)
  return index
}
export function personalEntry(source:BrowseEntry,changes:Record<string,unknown>|undefined):BrowseEntry {
  if(!changes||!Object.keys(changes).length)return source
  const entry={...source,...changes} as BrowseEntry
  delete entry.filterFacets
  if(changes.name)entry.displayName=String(changes.name)
  return entry
}
export async function browseEntrySource(userId:string,kind:BrowseKind,index:string):Promise<BrowseEntry|null> {
  if(index.startsWith('workshop-item-')&&(kind==='equipment'||kind==='magic-items')){
    const id=index.slice('workshop-item-'.length)
    if(!/^[a-f0-9]{24}$/i.test(id))return null
    const doc=await CustomContent.findOne({_id:id,userId,type:'item'}).lean()
    if(!doc)return null
    const item=prepareItem(doc.data as EquipmentItem)
    if(!!item.magical!==(kind==='magic-items'))return null
    return {index,name:item.name,displayName:`${item.name} · My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:item}
  }
  if(index.startsWith('homebrew-')){
    const probes:PreparedProbeContext={failed:new Set()}
    for(let attempt=0;attempt<3;attempt++){
      const revision=await browseRevision(userId)
      try{
        const locate=async()=>{
          const current=await compendiumBrowseIndex(userId,kind)
          if(current.revision!==revision)throw new BrowseRevisionChanged()
          return current.index.records.find(r=>r.entry.index===index)?.entry??null
        }
        const entry=await importedCompendiumSource(userId,kind,index,revision,locate,preparedReaderEnabled(userId)?()=>readPreparedSource(userId,revision,kind,index,locate,probes):undefined)
        if(await browseRevision(userId)!==revision)continue
        return entry&&kind==='monsters'?(await enrichedMonsterEntries(userId,[entry]))[0]!:entry
      }catch(error){if(!(error instanceof BrowseRevisionChanged))throw error}
    }
    throw new Error('Your library is changing. Please retry shortly.')
  }
  if(!/^[a-z0-9-]+$/i.test(index)||!['spells','equipment','magic-items','classes','subclasses','races','subraces','monsters','backgrounds','feats','languages'].includes(kind))return null
  const path=`${kind}/${index}`,local=localSrdRule(path)
  const entry=local===undefined?await readSrdRule(env.SRD_API_URL,path,{interactive:true}):local
  return entry&&typeof entry==='object'?enrichedStandardMonster(entry,path) as BrowseEntry:null
}
export async function personalBrowseEntry(userId:string,kind:BrowseKind,index:string) {
  const source=await browseEntrySource(userId,kind,index)
  if(!source)return null
  const filter:Record<string,unknown>={userId,type:'compendium-edit','data.kind':kind,'data.index':index}
  const doc=await CustomContent.findOne(filter).select('data.changes').lean()
  return personalEntry(source,(doc?.data as {changes?:Record<string,unknown>}|undefined)?.changes)
}
/** Derive facets from full entries before discarding descriptions, rules and art. */
export function compactBrowseEntry(source:BrowseEntry,kind:BrowseKind,preparedCompact=false):ReturnType<typeof browseRecord> {
  const record=browseRecord(source,kind)
  const identity:Record<string,unknown>=kind==='monsters'&&source.homebrew?
    preparedCompact?{...source,sources:undefined}:monsterBrowseEntry(source as unknown as OrcbrewEntry):source
  const fields=['index','name','url','displayName','sourcePack','source','sources','sourcePacks','aliases','contentKey','homebrew','itemReference','itemDamageTypes']
  const entry=Object.fromEntries(fields.filter(key=>identity[key]!==undefined).map(key=>[key,identity[key]])) as BrowseEntry
  if(kind==='subclasses')entry.class=subclassParent(source)
  if(kind==='subraces'||kind==='selections'||kind==='other')entry.familyContext=compendiumFamilyContext(source,kind)
  // Only identity/fingerprint metadata from monsterBrowseEntry, never full rules.
  if(kind==='monsters'&&source.homebrew)entry.details=identity.details
  if(source.workshopItem){
    const item=source.workshopItem
    entry.workshopItem=Object.fromEntries(['index','name','kind','category','rarity','requiresAttunement','weapon','armor','magical','magicIndex','tags'].filter(key=>item[key as keyof EquipmentItem]!==undefined).map(key=>[key,item[key as keyof EquipmentItem]])) as unknown as EquipmentItem
  }
  return {...record,entry}
}
async function buildIndex(userId:string,kind:BrowseKind):Promise<BrowseIndex> {
  const library=await workshopLibrary(userId)
  const imported=kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(library.catalog[kind],kind):library.catalog[kind]
  const path=kind==='equipment'||kind==='magic-items'?kind:`compendium/${kind}`
  const standard=(localSrdRule(path) as {results?:BrowseEntry[]}|null|undefined)?.results??[]
  const entries:BrowseEntry[]=[...standard,...imported as unknown as BrowseEntry[]]
  if(kind==='equipment'||kind==='magic-items'){
    const items=await CustomContent.find({userId,type:'item'}).lean()
    for(const doc of items){const item=prepareItem(doc.data as EquipmentItem);if(!!item.magical===(kind==='magic-items'))entries.push({index:`workshop-item-${doc._id}`,name:item.name,displayName:`${item.name} · My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:item})}
  }
  const editFilter:Record<string,unknown>={userId,type:'compendium-edit','data.kind':kind}
  const edits=await CustomContent.find(editFilter).select('data').lean()
  const changes=new Map(edits.map(doc=>{const data=doc.data as {index:string;changes:Record<string,unknown>};return [data.index,data.changes] as const}))
  const records=[]
  for(const entry of entries){
    const edit=changes.get(entry.index)
    // An edited sparse SRD index needs its full source before facet derivation.
    const source=edit&&Object.keys(edit).length&&!entry.index.startsWith('homebrew-')&&!entry.workshopItem?await browseEntrySource(userId,kind,entry.index):entry
    if(source)records.push(compactBrowseEntry(personalEntry(source,edit),kind))
  }
  return browseIndex(records,kind)
}
async function loadIndex(userId:string,kind:BrowseKind,revision:string,probes:PreparedProbeContext):Promise<IndexLoad> {
  const key=`${userId}:${revision}:${kind}`,cached=memory.get(key)
  if(cached)return {index:remember(key,cached),origin:'memory'}
  const existing=pending.get(key);if(existing)return existing
  const task=(async():Promise<IndexLoad>=>{
    const started=performance.now()
    const stored=await CompendiumBrowseIndex.find({userId,revision,kind}).sort({part:1}).lean()
    const decoded=decodeBrowseIndex(stored as unknown as IndexChunk[])
    if(decoded)return {index:remember(key,decoded),origin:'legacy'}
    if(preparedReaderEnabled(userId)){
      try{
        const preparedStored=await CompendiumBrowseIndex.find({userId,revision:preparedIndexRevision(revision),kind}).sort({part:1}).setOptions({maxTimeMS:1000,timeoutMS:1000}).lean()
        const preparedDecoded=decodeBrowseIndex(preparedStored as unknown as IndexChunk[])
        if(preparedDecoded)return {index:preparedDecoded,origin:'prepared-stored'}
      }catch(error){console.warn('Experimental category cache unavailable',{kind,name:(error as Error).name})}
      const prepared=await readPreparedIndex(userId,revision,kind,probes)
      // A shared pending load carries its origin. Every returning caller must
      // validate prepared data before returning or placing it in RAM.
      if(prepared)return {index:prepared,origin:'prepared'}
    }
    const index=await buildIndex(userId,kind)
    // Never publish an index assembled across a concurrent edit/import/delete.
    if(await browseRevision(userId)!==revision)throw new BrowseRevisionChanged()
    try{
      await initialize()
      const expiresAt=new Date(Date.now()+7*24*60*60*1000)
      const chunks=encodeBrowseIndex(index)
      await CompendiumBrowseIndex.bulkWrite(chunks.map(chunk=>({updateOne:{filter:{userId,revision,kind,part:chunk.part},update:{$set:{...chunk,expiresAt}},upsert:true}})))
      console.info('Compendium index built',{kind,entries:index.records.length,compressedBytes:chunks.reduce((n,c)=>n+c.payload.length,0),buildMs:Math.round(performance.now()-started)})
    }catch(error){console.warn('Compendium index persistence unavailable',{kind,name:(error as Error).name})}
    return {index:remember(key,index),origin:'built'}
  })()
  pending.set(key,task)
  try{return await task}finally{pending.delete(key)}
}
class BrowseRevisionChanged extends Error {}
export async function compendiumBrowseIndex(userId:string,kind:BrowseKind) {
  const probes:PreparedProbeContext={failed:new Set()}
  for(let attempt=0;attempt<3;attempt++){
    // Capture the exact immutable candidate BEFORE the metadata await. Eviction
    // cannot invalidate this reference; never reselect/relabel after the await.
    let captured:{revision:string;index:BrowseIndex}|undefined
    if(preparedReaderEnabled(userId)){
      const prefix=userId+':',suffix=':'+kind
      for(const [key,index]of memory)if(key.startsWith(prefix)&&key.endsWith(suffix))captured={revision:key.slice(prefix.length,-suffix.length),index}
    }
    const revision=await browseRevision(userId)
    if(captured?.revision===revision){
      const key=`${userId}:${revision}:${kind}`
      // Refresh only this exact validated reference. Eviction during the await
      // does not give permission to select/relabel another cached object.
      if(memory.get(key)===captured.index)remember(key,captured.index)
      return {revision,index:captured.index}
    }
    try{
      const loaded=await loadIndex(userId,kind,revision,probes)
      if(loaded.origin==='prepared'||loaded.origin==='prepared-stored'||(preparedReaderEnabled(userId)&&loaded.origin==='memory')){
        if(loaded.origin==='prepared'){
          // Persistence validates before its write; each returning/coalesced
          // caller validates again afterward before admission. No duplicate
          // pre-write metadata query is needed in this caller.
          await persistPreparedBrowseIndex(userId,kind,revision,loaded.index)
          if(await browseRevision(userId)!==revision)continue
          remember(`${userId}:${revision}:${kind}`,loaded.index)
        }
        else{
          if(await browseRevision(userId)!==revision)continue
          if(loaded.origin==='prepared-stored')remember(`${userId}:${revision}:${kind}`,loaded.index)
        }
      }
      return {revision,index:loaded.index}
    }catch(error){if(!(error instanceof BrowseRevisionChanged))throw error}
  }
  throw new Error('Your library is changing. Please retry shortly.')
}

const pendingPreparedWrites=new Map<string,Promise<void>>()
export async function persistPreparedBrowseIndex(userId:string,kind:BrowseKind,revision:string,index:BrowseIndex,strict=false){
 const key=`${userId}:${revision}:${kind}:${strict?'verified-job':'read'}`,previous=pendingPreparedWrites.get(key);if(previous)return previous
 const task=(async()=>{
  // Every prepared returning caller validates independently before invoking
  // this coalesced write; no unvalidated projection enters the legacy cache.
  if(await browseRevision(userId)!==revision)throw new BrowseRevisionChanged()
  try{
   const expiresAt=new Date(Date.now()+7*86400000),chunks=encodeBrowseIndex(index)
   await CompendiumBrowseIndex.bulkWrite(chunks.map(chunk=>({updateOne:{filter:{userId,revision:preparedIndexRevision(revision),kind,part:chunk.part},update:{$set:{...chunk,expiresAt}},upsert:true}})),{timeoutMS:strict?4000:1000})
   if(strict){
    const stored=await CompendiumBrowseIndex.find({userId,revision:preparedIndexRevision(revision),kind}).sort({part:1}).lean()
    const verified=decodeBrowseIndex(stored as unknown as IndexChunk[])
    if(!verified||JSON.stringify(verified)!==JSON.stringify(index))throw Error('Prepared category storage verification failed')
   }
  }catch(error){if(strict)throw error;console.warn('Prepared index persistence unavailable',{kind,name:(error as Error).name})}
 })()
 pendingPreparedWrites.set(key,task);try{await task}finally{if(pendingPreparedWrites.get(key)===task)pendingPreparedWrites.delete(key)}
}
