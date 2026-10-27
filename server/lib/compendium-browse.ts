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

// Bump when snapshot data, projection, grouping, filter or search semantics change.
const INDEX_VERSION='compendium-browse-1'
const memory=new Map<string,BrowseIndex>()
const pending=new Map<string,Promise<BrowseIndex>>()
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
function personalEntry(source:BrowseEntry,changes:Record<string,unknown>|undefined):BrowseEntry {
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
    const catalog=(await workshopLibrary(userId)).catalog
    const entries=kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(catalog[kind],kind):catalog[kind]
    const entry=entries.find(e=>e.index===index) as BrowseEntry|undefined
    if(!entry)return null
    return kind==='monsters'?(await enrichedMonsterEntries(userId,[entry]))[0]!:entry
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
export function compactBrowseEntry(source:BrowseEntry,kind:BrowseKind):ReturnType<typeof browseRecord> {
  const record=browseRecord(source,kind)
  const identity:Record<string,unknown>=kind==='monsters'&&source.homebrew?monsterBrowseEntry(source as unknown as OrcbrewEntry):source
  const fields=['index','name','url','displayName','sourcePack','source','sources','sourcePacks','aliases','contentKey','homebrew','itemReference','itemDamageTypes']
  const entry=Object.fromEntries(fields.filter(key=>identity[key]!==undefined).map(key=>[key,identity[key]])) as BrowseEntry
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
async function loadIndex(userId:string,kind:BrowseKind,revision:string):Promise<BrowseIndex> {
  const key=`${userId}:${revision}:${kind}`,cached=memory.get(key)
  if(cached)return remember(key,cached)
  const existing=pending.get(key);if(existing)return existing
  const task=(async()=>{
    const started=performance.now()
    const stored=await CompendiumBrowseIndex.find({userId,revision,kind}).sort({part:1}).lean()
    const decoded=decodeBrowseIndex(stored as unknown as IndexChunk[])
    if(decoded)return remember(key,decoded)
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
    return remember(key,index)
  })()
  pending.set(key,task)
  try{return await task}finally{pending.delete(key)}
}
class BrowseRevisionChanged extends Error {}
export async function compendiumBrowseIndex(userId:string,kind:BrowseKind) {
  for(let attempt=0;attempt<3;attempt++){
    const revision=await browseRevision(userId)
    try{return {revision,index:await loadIndex(userId,kind,revision)}}catch(error){if(!(error instanceof BrowseRevisionChanged))throw error}
  }
  throw new Error('Your library is changing. Please retry shortly.')
}
