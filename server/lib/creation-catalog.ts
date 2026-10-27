import {sourceHash,buildOrcbrewCatalog,type OrcbrewEntries} from './orcbrew'
import {activeWorkshopEntries} from './workshop-schema'
import {componentMetadata,readComponentCatalogues} from './compendium-components'
import {preparedReaderEnabled} from './compendium-prepared'
import {workshopLibrary} from './workshop-library'
import {withDatabaseStage} from './database-error'

export const CREATION_KINDS=['classes','races','backgrounds','subraces','subclasses','feats','languages','spells'] as const
export type CreationCatalog=Pick<OrcbrewEntries,typeof CREATION_KINDS[number]>
const pending=new Map<string,Promise<CreationCatalog>>()
const cache=new Map<string,{signature:string;catalog:CreationCatalog}>()
/** One scoped request for the builder, using prepared rules without loading
 * any monster/item sources. Never return a partial or stale catalogue. */
export async function creationCatalog(userId:string):Promise<CreationCatalog>{
 const existing=pending.get(userId);if(existing)return existing
 const task=(async()=>{
  const started=performance.now(),deadline=started+20000
  const metadata=await withDatabaseStage('library-metadata',()=>componentMetadata(userId,deadline))
  const signature=sourceHash(JSON.stringify(metadata)),previous=cache.get(userId)
  if(previous?.signature===signature)return previous.catalog
  let catalog:OrcbrewEntries
  if(preparedReaderEnabled(userId)){
   const packs=await withDatabaseStage('library-components',()=>readComponentCatalogues(userId,CREATION_KINDS,metadata,true,deadline))
   if(!packs)throw Error('Character options are being prepared. Please retry the library.')
   catalog=buildOrcbrewCatalog(packs)
  }else catalog=(await workshopLibrary(userId)).catalog
  const current=await withDatabaseStage('library-validation',()=>componentMetadata(userId,deadline))
  if(sourceHash(JSON.stringify(current))!==signature)throw Error('The library changed while loading. Please retry.')
  const result=Object.fromEntries(CREATION_KINDS.map(kind=>[kind,kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(catalog[kind],kind):catalog[kind]])) as CreationCatalog
  // Keep the full rule fields used by creation. Raw editor copies and identity
  // hashes are redundant in this response; references retain their stable IDs.
  const compact=Object.fromEntries(CREATION_KINDS.map(kind=>[kind,result[kind].map(entry=>{
   const {details,...rest}=entry,raw=details as Record<string,unknown>|undefined
   return {...rest,details:raw?Object.fromEntries([':profs',':props',':spellcasting',':help'].filter(key=>raw[key]!==undefined).map(key=>[key,raw[key]])):{}}
  })])) as unknown as CreationCatalog
  if(cache.size>=4)cache.delete(cache.keys().next().value!)
  cache.set(userId,{signature,catalog:compact})
  console.info('Creation catalogue loaded',{packs:metadata.length,ms:Math.round(performance.now()-started),bytes:Buffer.byteLength(JSON.stringify(compact))})
  return compact
 })()
 pending.set(userId,task)
 try{return await task}finally{if(pending.get(userId)===task)pending.delete(userId)}
}
