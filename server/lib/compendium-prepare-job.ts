import {CompendiumComponent,CompendiumComponentObject} from '../models/CompendiumComponent'
import {CompendiumBrowseIndex} from '../models/CompendiumBrowseIndex'
import {componentMetadata,componentContext,prepareComponent,COMPONENT_VERSION} from './compendium-components'
import {readPreparedIndex} from './compendium-prepared'
import {browseRevision,persistPreparedBrowseIndex} from './compendium-browse'
import {BROWSE_KINDS} from '../../shared/compendium-browse'

/** Explicit awaited operator action. No source writes, character propagation,
 * automatic model initialization or untracked background work. */
export async function prepareCompendium(userId:string,options:{writeDerived?:boolean;replace?:boolean;pruneDerived?:boolean}={}) {
 if(!options.writeDerived)throw Error('Use --write-derived for the explicit isolated preparation job. No implicit data preparation.')
 const started=performance.now(),revision=await browseRevision(userId),packs=await componentMetadata(userId)
 const unchanged=async()=>{if(await browseRevision(userId)!==revision)throw Error('Library changed during preparation; repeat for the current revision')}
 if(packs.some(p=>!componentContext(p)))throw Error('A pack has no exact source fingerprint; use the current reader')
 // Only these derived models are initialized by the operator, never browse.
 for(const model of [CompendiumComponent,CompendiumComponentObject,CompendiumBrowseIndex]){await model.createCollection();await model.createIndexes()}
 const observed=await CompendiumComponent.find({userId,version:COMPONENT_VERSION,context:{$in:packs.map(componentContext)}}).select('generation').lean()
 let prepared=0,reused=0
 for(const pack of packs){
  await unchanged()
  const existing=await CompendiumComponent.findOne({userId,context:componentContext(pack),sources:true}).lean()
  if(existing&&!options.replace){reused++;continue}
  await prepareComponent(pack,{sources:true,replace:options.replace});prepared++
  // Full sources and parse trees from a previous pack fall out of scope here.
 }
 const counts:Record<string,number>={}
 for(const kind of BROWSE_KINDS){
  await unchanged()
  const index=await readPreparedIndex(userId,revision,kind,{failed:new Set(),deadline:Infinity})
  if(!index)throw Error('Prepared category could not be verified: '+kind)
  counts[kind]=index.records.length
  await unchanged();await persistPreparedBrowseIndex(userId,kind,revision,index,true)
 }
 await unchanged()
 const pruned=options.pruneDerived?await pruneComponents(userId,{dryRun:false,protectedGenerations:observed.map(m=>m.generation)}):undefined
 await unchanged()
 return {revision,prepared,reused,counts,pruned,prepareMs:Math.round(performance.now()-started),ownerActivationRequired:true}
}

/** Explicit maintenance only, after verified preparation. Retain every current
 * ready generation and all recent attempts; never touch source collections. */
export async function pruneComponents(userId:string,options:{dryRun?:boolean;protectedGenerations?:string[]}={}){
 const packs=await componentMetadata(userId),contexts=packs.map(componentContext)
 if(contexts.some(c=>!c))throw Error('Cannot prune without exact current component identities')
 const cutoff=new Date(Date.now()-24*60*60*1000)
 const protectedSet=new Set(options.protectedGenerations??[]),dryRun=options.dryRun!==false
 const manifests=await CompendiumComponent.find({userId,version:COMPONENT_VERSION}).select('generation context createdAt').limit(10001).setOptions({maxTimeMS:4000,timeoutMS:5000}).lean()
 if(manifests.length>10000||protectedSet.size>10000)throw Error('Derived generation maintenance requires a smaller explicit batch')
 const obsolete=manifests.filter(m=>!contexts.includes(m.context)&&m.createdAt<cutoff&&!protectedSet.has(m.generation))
 for(const m of manifests)if(!obsolete.includes(m))protectedSet.add(m.generation)
 const objectFilter={userId,version:COMPONENT_VERSION,generation:{$nin:[...protectedSet]},createdAt:{$lt:cutoff}}
 const oldUnreferencedChunks=await CompendiumComponentObject.countDocuments(objectFilter).setOptions({maxTimeMS:4000,timeoutMS:5000})
 if(!dryRun){
  // Each observed stale manifest is removed by generation CAS. New publication
  // can never be removed merely because it replaced an old context during GC.
  for(const m of obsolete)await CompendiumComponent.deleteOne({userId,version:COMPONENT_VERSION,context:m.context,generation:m.generation,createdAt:{$lt:cutoff}}).setOptions({maxTimeMS:4000,timeoutMS:5000})
  // Re-read references after deletion before pruning old orphan chunks.
  const latest=await CompendiumComponent.find({userId,version:COMPONENT_VERSION}).select('generation').limit(10001).setOptions({maxTimeMS:4000,timeoutMS:5000}).lean()
  if(latest.length>10000)throw Error('Too many live derived generations to prune safely')
  for(const m of latest)protectedSet.add(m.generation)
  await CompendiumComponentObject.deleteMany({...objectFilter,generation:{$nin:[...protectedSet]}}).setOptions({maxTimeMS:4000,timeoutMS:5000})
 }
 return {dryRun,obsoleteReady:obsolete.length,oldUnreferencedChunks,recentAttemptsRetained:true,observedGenerationsRetained:true}
}
