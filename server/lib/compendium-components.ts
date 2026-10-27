import {randomUUID} from 'node:crypto'
import {Types} from 'mongoose'
import {gunzipSync} from 'node:zlib'
import {CustomContent} from '../models/CustomContent'
import {CompendiumComponent,CompendiumComponentObject} from '../models/CompendiumComponent'
import {sourceHash,inspectOrcbrew,buildOrcbrewCatalog,ORCBREW_KINDS,type OrcbrewEntry,type OrcbrewEntries,type CatalogPack,type ParsedOrcbrew} from './orcbrew'
import {readPackDocuments} from './pack-source'
import {parsedPack} from './orcbrew-library'
import {compactBrowseEntry} from './compendium-browse'
import {compendiumFacets} from '../../shared/compendium-facets'
import {encodePrepared,decodePrepared,PREPARED_SOURCE_MAX,type StoredPreparedChunk} from './compendium-prepared-codec'
import type {BrowseEntry,BrowseKind} from '../../shared/compendium-browse'

export const COMPONENT_VERSION='compendium-components-3-families'
export const COMPONENT_METADATA='_catalogue'
const MAX_CATEGORY_BYTES=64*1024*1024,MAX_COMPRESSED_BYTES=32*1024*1024,MAX_COMPONENT_ENTRIES=100000
const REQUEST_SOURCE_BYTES=1024*1024,REQUEST_PROJECTION_BYTES=8*1024*1024,REQUEST_ENTRIES=5000
// Most of a multi-category read is verified empty objects. Small batches made
// 126 packs require dozens of network round trips before any catalogue loaded.
// MongoDB still caps each wire batch at 16 MiB; total compressed/decoded bytes
// are checked below before retention, independently of the requested count.
const CATALOGUE_BATCH_SIZE=128,CHUNK_BYTES=512*1024
interface RepairBudget {deadline:number;attempts:number;sourceBytes:number;projectionBytes:number;entries:number;chunks:number}
function remaining(deadline:number,max=1000) {
 const ms=Math.min(max,Math.floor(deadline-performance.now()))
 if(ms<=0)throw Error('Component request budget exhausted')
 return ms
}
const pending=new Map<string,Promise<ComponentProjection>>()
export interface PackMetadata {_id:Types.ObjectId;userId:Types.ObjectId;sourceHash?:string;updatedAt?:Date;data:{filename:string;includeDisabled?:boolean;sourceEncoding?:string;sourceBytes?:number}}
export interface ReadyComponent {version:string;userId:Types.ObjectId;context:string;generation:string;counts:Record<string,number>;bytes:Record<string,number>;sources:boolean}
export interface ComponentProjection {ready:ReadyComponent;entries:OrcbrewEntries}
export const packFilter=(p:PackMetadata)=>({_id:p._id,userId:p.userId,type:'orcbrew' as const,sourceHash:p.sourceHash,updatedAt:p.updatedAt})
export function componentContext(p:PackMetadata):string|null {
 if(typeof p.sourceHash!=='string'||!/^[a-f0-9]{64}$/i.test(p.sourceHash)||typeof p.data?.filename!=='string'||!p.updatedAt)return null
 return sourceHash(JSON.stringify([COMPONENT_VERSION,String(p.userId),String(p._id),p.sourceHash,p.updatedAt,p.data.filename,p.data.includeDisabled===true]))
}
export async function componentMetadata(userId:string,deadline=Infinity):Promise<PackMetadata[]> {
 return CustomContent.find({userId,type:'orcbrew'}).select('_id userId sourceHash updatedAt data.filename data.includeDisabled data.sourceEncoding data.sourceBytes').sort({_id:1}).setOptions({maxTimeMS:2000,timeoutMS:remaining(deadline,2000)}).lean() as unknown as Promise<PackMetadata[]>
}
function emptyEntries():OrcbrewEntries{return Object.fromEntries(ORCBREW_KINDS.map(k=>[k,[]])) as unknown as OrcbrewEntries}
function projection(parsed:ParsedOrcbrew):OrcbrewEntries {
 const result=emptyEntries()
 for(const kind of ORCBREW_KINDS)for(const entry of parsed.entries[kind]){
  // Workshop lineage/facet derivation requires complete class/race material.
  // Fingerprints are the original parser IDs; never hash omitted rule fields.
  if(kind!=='monsters'&&kind!=='equipment'&&kind!=='magic-items'){result[kind].push(entry);continue}
  const compact=compactBrowseEntry(entry as unknown as BrowseEntry,kind).entry
  result[kind].push({...compact,index:entry.index,name:entry.name,contentKey:entry.contentKey,source:entry.source,disabled:entry.disabled,legacyKey:entry.legacyKey,filterFacets:compendiumFacets(entry,kind),details:compact.details??{}} as OrcbrewEntry)
 }
 return result
}
function validEntries(value:unknown,kind:BrowseKind,maxEntries:number):value is OrcbrewEntry[] {
 return Array.isArray(value)&&value.length<=maxEntries&&value.every(e=>e&&typeof e==='object'&&typeof e.index==='string'&&e.index.startsWith(`homebrew-${kind}-`)&&typeof e.name==='string'&&typeof e.contentKey==='string'&&typeof e.source==='string'&&typeof e.disabled==='boolean'&&typeof e.legacyKey==='string'&&e.details&&typeof e.details==='object')
}
async function boundedRequestPack(p:PackMetadata,budget:RepairBudget) {
 const deadline=budget.deadline
 if(performance.now()>deadline)throw Error('Component request budget exhausted')
 // Check byte eligibility in Mongo without transferring the source. The exact
 // document filter is reused by the subsequent bounded source read.
 const [size]=await CustomContent.aggregate<{stored:number;decoded:number}>([
  {$match:packFilter(p)},{$project:{_id:0,stored:{$strLenBytes:{$ifNull:['$data.source','']}},decoded:{$cond:[{$eq:['$data.sourceEncoding','gzip-base64']},'$data.sourceBytes',{$strLenBytes:{$ifNull:['$data.source','']}}]}}},
 ]).option({maxTimeMS:remaining(deadline),timeoutMS:remaining(deadline)})
 if(!size||!Number.isInteger(size.decoded)||size.decoded<=0||size.decoded>REQUEST_SOURCE_BYTES||size.stored>2*REQUEST_SOURCE_BYTES||budget.sourceBytes+size.decoded>2*REQUEST_SOURCE_BYTES)throw Error('Changed source requires explicit preparation')
 budget.sourceBytes+=size.decoded
 if(performance.now()>deadline)throw Error('Component request budget exhausted')
 const doc=await CustomContent.findOne(packFilter(p)).select('data').setOptions({maxTimeMS:remaining(deadline),timeoutMS:remaining(deadline)}).lean()
 if(!doc)throw Error('Source changed during component read')
 const data=doc.data as {source:string;sourceEncoding?:string;sourceBytes?:number}
 const source=data.sourceEncoding==='gzip-base64'?gunzipSync(Buffer.from(data.source,'base64'),{maxOutputLength:REQUEST_SOURCE_BYTES}).toString('utf8'):data.source
 if(typeof source!=='string'||Buffer.byteLength(source)>REQUEST_SOURCE_BYTES||sourceHash(source)!==p.sourceHash)throw Error('Invalid bounded component source')
 return source
}
export async function prepareComponent(p:PackMetadata,options:{sources?:boolean;replace?:boolean;budget?:RepairBudget;expectedGeneration?:string}={}):Promise<ComponentProjection> {
 const context=componentContext(p);if(!context)throw Error('Source has no exact reusable component identity')
 // Request repairs are not allowed to wait for an unbounded operator job.
 const key=String(p.userId)+':'+context+':'+!!options.sources+':'+(options.budget?'request':'operator'),previous=pending.get(key)
 if(previous){if(options.budget)throw Error('Component repair already in progress');return previous}
 const task=(async()=>{
  const deadline=options.budget?.deadline??Infinity
  let source:string
  if(options.budget){if(++options.budget.attempts>2)throw Error('Component repair count exhausted');source=await boundedRequestPack(p,options.budget)}
  else{
   const doc=(await readPackDocuments(String(p.userId),String(p._id)))[0]
   if(!doc||componentContext(doc as unknown as PackMetadata)!==context)throw Error('Source changed before component preparation')
   source=(doc.data as {source:string}).source
   if(sourceHash(source)!==p.sourceHash)throw Error('Source fingerprint mismatch')
  }
  // Reuse the current parser's bounded cache for a small repair. If later
  // persistence/composition falls back, the legacy reader can reuse this parse.
  const parsed=options.budget?parsedPack({source}):inspectOrcbrew(source),entries=projection(parsed)
  const counts=Object.fromEntries(ORCBREW_KINDS.map(k=>[k,entries[k].length])),bytes=Object.fromEntries(ORCBREW_KINDS.map(k=>[k,Buffer.byteLength(JSON.stringify(entries[k]))]))
  if(options.budget){
   options.budget.entries+=Object.values(counts).reduce((a,b)=>a+b,0)
   options.budget.projectionBytes+=Object.values(bytes).reduce((a,b)=>a+b,0)
   if(options.budget.entries>REQUEST_ENTRIES||options.budget.projectionBytes>REQUEST_PROJECTION_BYTES)throw Error('Changed source projection exceeds request budget')
   remaining(deadline)
  }
  const ready:ReadyComponent={version:COMPONENT_VERSION,userId:p.userId,context,generation:randomUUID(),counts,bytes,sources:options.sources===true}
  type ObjectWrite={version:string;userId:Types.ObjectId;generation:string;kind:BrowseKind;role:string;index:string;part:number;parts:number;digest:string;payload:Buffer;createdAt:Date}
  let batch:ObjectWrite[]=[],batchBytes=0
  const flush=async()=>{
   if(!batch.length)return
   const group=batch;batch=[];batchBytes=0
   if(performance.now()>deadline)throw Error('Component request budget exhausted')
   const timeout=Number.isFinite(deadline)?remaining(deadline):4000
   await CompendiumComponentObject.collection.insertMany(group,{ordered:true,timeoutMS:timeout})
   const stored=await CompendiumComponentObject.find({userId:p.userId,generation:ready.generation,$or:group.map(o=>({kind:o.kind,role:o.role,index:o.index}))}).select('kind role index part parts digest payload').setOptions({maxTimeMS:timeout,timeoutMS:Number.isFinite(deadline)?remaining(deadline):4000}).lean()
   for(const object of group){
    if(object.part!==0)continue
    const chunks=stored.filter(s=>s.kind===object.kind&&s.role===object.role&&s.index===object.index)
    if(chunks.length!==object.parts||chunks.some(c=>c.digest!==object.digest||c.parts!==object.parts)||!decodePrepared(chunks as unknown as StoredPreparedChunk[],object.role==='source'?PREPARED_SOURCE_MAX:MAX_CATEGORY_BYTES))throw Error('Component storage verification failed')
   }
  }
  const persist=async(kind:BrowseKind,role:string,index:string,value:unknown,max:number)=>{
   const chunks=encodePrepared(value,max),size=chunks.reduce((n,c)=>n+c.payload.length,0)
   if(options.budget&&((options.budget.chunks+=chunks.length)>32))throw Error('Component repair chunk budget exceeded')
   if(batch.length&&(batch.length+chunks.length>32||batchBytes+size>512*1024))await flush()
   batch.push(...chunks.map(chunk=>({version:COMPONENT_VERSION,userId:p.userId,generation:ready.generation,kind,role,index,...chunk,createdAt:new Date()})));batchBytes+=size
   if(batch.length>=32||batchBytes>=512*1024)await flush()
  }
  try{
   // Empty categories have an explicit checked object as well. A damaged count
   // must not silently turn a real category into an unverified empty result.
   for(const kind of ORCBREW_KINDS)await persist(kind,'catalogue',COMPONENT_METADATA,entries[kind],MAX_CATEGORY_BYTES)
   if(options.sources){
    const catalog=buildOrcbrewCatalog([{id:String(p._id),filename:p.data.filename,includeDisabled:p.data.includeDisabled,parsed}])
    // Store the raw one-pack catalog. Active lineage is selected globally on read.
    for(const kind of ORCBREW_KINDS)for(const entry of catalog[kind])await persist(kind,'source',entry.index,entry,PREPARED_SOURCE_MAX)
   }
   await flush()
   const current=await CustomContent.findOne(packFilter(p)).select('_id userId sourceHash updatedAt data.filename data.includeDisabled').setOptions({maxTimeMS:1000,timeoutMS:Number.isFinite(deadline)?remaining(deadline):4000}).lean()
   if(!current||componentContext(current as unknown as PackMetadata)!==context)throw Error('Source changed during component preparation')
   if(performance.now()>deadline)throw Error('Component request budget exhausted')
   // CAS replacement never downgrades a concurrently completed full preparation.
   const existing=await CompendiumComponent.findOne({userId:p.userId,context}).setOptions({maxTimeMS:1000,timeoutMS:Number.isFinite(deadline)?remaining(deadline):4000}).lean()
   // A repair may replace only the exact invalid generation it observed. Never
   // downgrade a newer full preparation that won while this attempt ran.
   if(options.budget&&existing?.generation!==options.expectedGeneration)return {ready,entries}
   if(existing?.sources&&!options.sources&&!options.replace)return {ready,entries}
   const filter={userId:p.userId,context,...existing?{generation:existing.generation}:{}}
   try{
    const saved=await CompendiumComponent.findOneAndUpdate(filter,{$set:{...ready,createdAt:new Date()}},{upsert:!existing,returnDocument:'after',maxTimeMS:1000,timeoutMS:Number.isFinite(deadline)?remaining(deadline):4000}).lean()
    if(saved)return {ready:saved as unknown as ReadyComponent,entries}
   }catch(error){if((error as {code?:number}).code!==11000)throw error}
   // Another immutable attempt won. Our verified projection still belongs to
   // this exact input; caller must perform its final global revision validation.
  }catch(error){
   if(!Number.isFinite(deadline))throw error
   console.warn('Component persistence unavailable; using verified request projection',{name:(error as Error).name})
  }
  return {ready,entries}
 })()
 pending.set(key,task)
 try{return await task}finally{if(pending.get(key)===task)pending.delete(key)}
}

export async function readComponentCatalogues(userId:string,kind:BrowseKind|readonly BrowseKind[],packs:PackMetadata[],repair=true,deadline=performance.now()+2500):Promise<CatalogPack[]|null> {
 const kinds:readonly BrowseKind[]=typeof kind==='string'?[kind]:[...new Set(kind)]
 if(!kinds.length||kinds.some(k=>!ORCBREW_KINDS.includes(k)))return null
 const contexts=packs.map(componentContext);if(contexts.some(c=>!c))return null
 const manifests=await CompendiumComponent.find({userId,context:{$in:contexts}}).setOptions({maxTimeMS:2000,timeoutMS:remaining(deadline,2000)}).lean() as unknown as ReadyComponent[]
 const byContext=new Map(manifests.map(m=>[m.context,m])),results=new Map<string,OrcbrewEntries>(),bad=new Set<string>()
 let declared=0
 for(const p of packs){const key=componentContext(p)!,m=byContext.get(key)
  for(const k of kinds){const count=m?.counts?.[k],bytes=m?.bytes?.[k]
   if(!m||typeof m.generation!=='string'||!m.generation||!Number.isInteger(count)||count!<0||count!>MAX_COMPONENT_ENTRIES||!Number.isInteger(bytes)||bytes!<2||bytes!>MAX_CATEGORY_BYTES||(!count&&bytes!==2)){bad.add(key);continue}
   declared+=bytes!;if(declared>MAX_CATEGORY_BYTES)return null
  }
 }
 const generationKeys=new Map(manifests.map(m=>[m.generation,m.context])),groups=new Map<string,StoredPreparedChunk[]>();let compressed=0,chunks=0
 const cursor=CompendiumComponentObject.find({userId,generation:{$in:manifests.map(m=>m.generation)},kind:{$in:kinds},role:'catalogue',index:COMPONENT_METADATA}).select('generation kind part parts digest payload').sort({generation:1,kind:1,part:1}).setOptions({maxTimeMS:4000,timeoutMS:remaining(deadline,15000)}).lean().cursor({batchSize:CATALOGUE_BATCH_SIZE})
 try{for await(const object of cursor){
  remaining(deadline)
  if(++chunks>Math.max(1,packs.length)*kinds.length*129)return null
  const context=generationKeys.get(object.generation);if(!context||!kinds.includes(object.kind as BrowseKind))return null
  // Lean Mongo reads return BSON Binary (whose length is a method), while
  // hydrated documents return Buffer. Validate the bytes in either form.
  const payload=object.payload as unknown as {buffer?:Uint8Array;position?:number}
  const size=payload instanceof Uint8Array?payload.byteLength:
   payload?.buffer instanceof Uint8Array&&Number.isInteger(payload.position)&&payload.position!>=0&&payload.position!<=payload.buffer.byteLength?payload.position:undefined
  if(!Number.isInteger(size)||size!<0||size!>CHUNK_BYTES)return null
  compressed+=size!;if(compressed>MAX_COMPRESSED_BYTES)return null
  const key=context+':'+object.kind,list=groups.get(key)??[];if(list.length>=129)return null;list.push(object as unknown as StoredPreparedChunk);groups.set(key,list)
 }}finally{await cursor.close()}
 for(const p of packs){const key=componentContext(p)!,m=byContext.get(key);if(!m||bad.has(key))continue
  const entries=emptyEntries()
  for(const k of kinds){
   remaining(deadline)
   const value=decodePrepared(groups.get(key+':'+k)??[],Math.min(MAX_CATEGORY_BYTES,m.bytes[k]!))
   if(!validEntries(value,k,MAX_COMPONENT_ENTRIES)||value.length!==m.counts[k]||Buffer.byteLength(JSON.stringify(value))!==m.bytes[k]){bad.add(key);break}
   entries[k]=value
  }
  if(!bad.has(key))results.set(key,entries)
 }
 // A multi-category read shares the same two-component repair and total byte,
 // chunk and time budgets as one category. No repair per category multiplication.
 if(bad.size){
  if(!repair||bad.size>2)return null
  const budget:RepairBudget={deadline,attempts:0,sourceBytes:0,projectionBytes:0,entries:0,chunks:0}
  for(const p of packs)if(bad.has(componentContext(p)!)){
   try{const refreshed=await prepareComponent(p,{replace:byContext.has(componentContext(p)!),expectedGeneration:byContext.get(componentContext(p)!)?.generation,budget});const entries=emptyEntries();for(const k of kinds)entries[k]=refreshed.entries[k];results.set(componentContext(p)!,entries)}
   catch(error){console.warn('Compendium component requires legacy reader',{name:(error as Error).name});return null}
  }
 }
 if([...results.values()].reduce((n,entries)=>n+kinds.reduce((bytes,k)=>bytes+Buffer.byteLength(JSON.stringify(entries[k])),0),0)>MAX_CATEGORY_BYTES)return null
 remaining(deadline)
 return packs.map(p=>({id:String(p._id),filename:p.data.filename,includeDisabled:p.data.includeDisabled,parsed:{entries:results.get(componentContext(p)!)!,report:{packCount:1,entryCount:0,disabledCount:0,duplicateCount:0,nonFiniteCount:0,counts:Object.fromEntries(ORCBREW_KINDS.map(k=>[k,0])) as ParsedOrcbrew['report']['counts'],warnings:[]}}}))
}

export async function readComponentSource(userId:string,kind:BrowseKind,index:string,locator:BrowseEntry):Promise<BrowseEntry|null> {
 const deadline=performance.now()+2500,packs=await componentMetadata(userId,deadline),names=Array.isArray(locator.sourcePacks)?locator.sourcePacks:[],ids=(Array.isArray(locator.aliases)?locator.aliases:[]).flatMap(a=>typeof a==='string'?a.match(/^homebrew-([a-f0-9]{24})-/i)?.[1]??[]:[])
 const candidates=packs.filter(p=>names.length?names.includes(p.data.filename):ids.includes(String(p._id)))
 const ready=await CompendiumComponent.find({userId,context:{$in:candidates.map(componentContext).filter(Boolean)}}).setOptions({maxTimeMS:2000,timeoutMS:remaining(deadline,2000)}).lean()
 for(const p of candidates){
  // The earliest candidate is the baseline source winner. An unavailable or
  // corrupt component must fall back to targeted parsing, never skip to a later
  // duplicate whose raw rule payload/provenance could differ.
  const m=ready.find(r=>r.context===componentContext(p));if(!m?.sources)return null
  const chunks=await CompendiumComponentObject.find({userId,generation:m.generation,kind,role:'source',index}).select('part parts digest payload').sort({part:1}).limit(10).setOptions({maxTimeMS:2000,timeoutMS:remaining(deadline,2000)}).lean()
  const value=decodePrepared(chunks as unknown as StoredPreparedChunk[],PREPARED_SOURCE_MAX) as BrowseEntry|null
  remaining(deadline)
  if(!value||value.index!==index||value.homebrew!==true||typeof value.name!=='string')return null
  // Preserve the baseline's global active-lineage normalization for the winner.
  const {activeWorkshopEntries}=await import('./workshop-schema')
  const entry=(kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries([value as unknown as OrcbrewEntry],kind)[0]:value) as BrowseEntry
  for(const key of ['source','sourcePack','sourcePacks','sources','aliases'])if(locator[key]!==undefined)entry[key]=locator[key]
  if(locator.name===entry.name&&locator.displayName!==undefined)entry.displayName=locator.displayName
  return entry
 }
 return null
}
