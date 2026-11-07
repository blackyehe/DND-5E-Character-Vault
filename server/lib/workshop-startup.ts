import {buildOrcbrewCatalog} from './orcbrew'
import {workshopLibrary} from './workshop-library'
import {characterRules} from './workshop-rules'
import {activeWorkshopEntries} from './workshop-schema'
import {preparedReaderEnabled} from './compendium-prepared'

const pending=new Map<string,Promise<Awaited<ReturnType<typeof opening>>>>()
type Startup=ReturnType<typeof response>
const resident=new Map<string,{signature:string;value:Startup;bytes:number}>()
let residentBytes=0
const MAX_RESIDENT_BYTES=16*1024*1024
function remember(owner:string,signature:string,value:Startup){
 const bytes=Buffer.byteLength(JSON.stringify(value));if(bytes>MAX_RESIDENT_BYTES)return
 const old=resident.get(owner);if(old){residentBytes-=old.bytes;resident.delete(owner)}
 while(resident.size&&(resident.size>=4||residentBytes+bytes>MAX_RESIDENT_BYTES)){const key=resident.keys().next().value!;residentBytes-=resident.get(key)!.bytes;resident.delete(key)}
 resident.set(owner,{signature,value,bytes});residentBytes+=bytes
}
const kinds=['classes','subclasses','races','spells'] as const
function response(packs:Awaited<ReturnType<typeof workshopLibrary>>['packs'],catalog:ReturnType<typeof buildOrcbrewCatalog>,rules:ReturnType<typeof characterRules>['rules'],hashes:Map<string,string>,warnings:string[]){
 return {classes:activeWorkshopEntries(catalog.classes,'classes'),subclasses:activeWorkshopEntries(catalog.subclasses,'subclasses'),races:activeWorkshopEntries(catalog.races,'races'),spells:catalog.spells,
  library:{packs:packs.map(p=>({id:p.id,filename:p.filename,hash:hashes.get(p.id)!,entries:[...p.parsed.entries.classes,...p.parsed.entries.subclasses,...p.parsed.entries.races].map(e=>e.index)})),rules:rules.filter(r=>r.revision>0).map(r=>({id:r.id,revision:r.revision,index:r.index,previousIndexes:r.previousIndexes})),warnings}}
}
async function opening(userId:string){
 if(preparedReaderEnabled(userId))try{
  const {componentMetadata,componentContext,readComponentCatalogues}=await import('./compendium-components')
  const deadline=performance.now()+10000,metadata=await componentMetadata(userId,deadline)
  const contexts=metadata.map(componentContext),signature=JSON.stringify(contexts),previous=resident.get(userId)
  if(contexts.every(Boolean)&&previous?.signature===signature){resident.delete(userId);resident.set(userId,previous);return {value:previous.value,reader:'resident' as const}}
  // These four categories retain complete authoring definitions in components.
  // No monster/item projection is used as an editable class, race or spell.
  const packs=await readComponentCatalogues(userId,kinds,metadata,false,deadline)
  if(packs){
   const current=await componentMetadata(userId,deadline)
   if(JSON.stringify(current.map(componentContext))===JSON.stringify(metadata.map(componentContext))){
    const catalog=buildOrcbrewCatalog(packs),{rules}=characterRules(catalog)
    const value=response(packs,catalog,rules,new Map(metadata.map(p=>[String(p._id),p.sourceHash!])),[])
    if(contexts.every(Boolean))remember(userId,signature,value)
    return {value,reader:'prepared' as const}
   }
  }
 }catch{/* A missing, stale or unavailable component never becomes a partial library. */}
 const lib=await workshopLibrary(userId)
 const {sourceHash}=await import('./orcbrew')
 return {value:response(lib.packs,lib.catalog,lib.rules,new Map(lib.docs.map(d=>[String(d._id),sourceHash(String((d.data as {source:string}).source))])),lib.warnings),reader:'legacy' as const}
}
/** One HTTP request replaces five simultaneous full-library reconstructions. */
export async function workshopStartup(userId:string,onReader?:(reader:'prepared'|'resident'|'legacy')=>void){
 const previous=pending.get(userId),task=previous??opening(userId);if(!previous)pending.set(userId,task)
 try{const result=await task;onReader?.(result.reader);return result.value}finally{if(pending.get(userId)===task)pending.delete(userId)}
}
