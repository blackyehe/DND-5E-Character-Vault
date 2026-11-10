import type {BrowseKind} from '../../shared/compendium-kinds'
import {OPTION_KINDS} from '../../shared/option-kinds'
import {preparedReaderEnabled} from './compendium-prepared'
import {componentContext,componentMetadata,readComponentCatalogues} from './compendium-components'
import {workshopLibrary} from './workshop-library'
import {sourceHash,type CatalogPack} from './orcbrew'
import {nativeOption} from './option-workshop'

type SourceDocuments=Awaited<ReturnType<typeof workshopLibrary>>['docs']
interface OptionLibrary {packs:CatalogPack[];hashes:Map<string,string>;warnings:string[];docs?:SourceDocuments}
/** Author options from complete option components, without loading monsters/items.
 * The target pack's source is read separately only when it is actually saved. */
export async function authoringPacks(owner:string|undefined,kinds:readonly BrowseKind[]){
 let lib:OptionLibrary|undefined
 if(owner&&preparedReaderEnabled(owner))try{
  const deadline=performance.now()+10000,metadata=await componentMetadata(owner,deadline),contexts=metadata.map(componentContext)
  if(contexts.every(Boolean)){
   const packs=await readComponentCatalogues(owner,kinds,metadata,false,deadline)
   if(packs&&JSON.stringify((await componentMetadata(owner,deadline)).map(componentContext))===JSON.stringify(contexts))lib={packs,hashes:new Map(metadata.map(p=>[String(p._id),p.sourceHash!])),warnings:[]}
  }
 }catch{/* Incomplete or unavailable components never become a partial library. */}
 if(!lib){const full=await workshopLibrary(owner);lib={packs:full.packs,docs:full.docs,hashes:new Map(full.docs.map(d=>[String(d._id),sourceHash(String((d.data as {source:string}).source))])),warnings:full.warnings}}
 return lib
}
export async function optionAuthoringLibrary(owner:string|undefined){
 const lib=await authoringPacks(owner,OPTION_KINDS)
 return {lib,rows:lib.packs.flatMap(pack=>OPTION_KINDS.flatMap(kind=>pack.parsed.entries[kind].flatMap(entry=>{const draft=nativeOption(entry);return draft?[{pack,entry,draft}]:[]})))}
}
