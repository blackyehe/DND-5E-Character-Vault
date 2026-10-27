import {CustomContent} from '../models/CustomContent'
import {env} from '../env'
import {componentMetadata,componentContext,readComponentCatalogues,readComponentSource} from './compendium-components'
import {buildOrcbrewCatalog,sourceHash,type OrcbrewEntry} from './orcbrew'
import {activeWorkshopEntries} from './workshop-schema'
import {warmWorkshopCatalog} from './workshop-library'
import {localSrdRule} from './srd-snapshot'
import {prepareItem} from './inventory'
import {compactBrowseEntry,personalEntry,browseEntrySource} from './compendium-browse'
import {targetedCompendiumSource} from './compendium-entry-source'
import {browseIndex,type BrowseIndex,type BrowseEntry,type BrowseKind} from '../../shared/compendium-browse'
import type {EquipmentItem} from '../../shared/character'

export interface PreparedProbeContext {failed:Set<string>;deadline?:number}
const users=new Set(env.COMPENDIUM_PREPARED_USERS.split(',').map(s=>s.trim()).filter(Boolean))
// Reuse only an exact ordered pack composition. Personal editions/templates are
// deliberately excluded and overlaid afresh below. No full sources are retained.
const compositions=new Map<string,{entries:OrcbrewEntry[];bytes:number}>()
let compositionBytes=0
function rememberComposition(key:string,entries:OrcbrewEntry[]){
 const bytes=Buffer.byteLength(JSON.stringify(entries))
 if(bytes>32*1024*1024)return
 const previous=compositions.get(key);if(previous){compositionBytes-=previous.bytes;compositions.delete(key)}
 while(compositions.size&&(compositions.size>=8||compositionBytes+bytes>32*1024*1024)){
  const oldest=compositions.keys().next().value!;compositionBytes-=compositions.get(oldest)!.bytes;compositions.delete(oldest)
 }
 compositions.set(key,{entries,bytes});compositionBytes+=bytes
}
export const preparedReaderEnabled=(userId:string)=>env.COMPENDIUM_READER==='prepared'&&(users.has('*')||users.has(userId))
export async function readPreparedIndex(userId:string,revision:string,kind:BrowseKind,context?:PreparedProbeContext):Promise<BrowseIndex|null> {
 const key=JSON.stringify([userId,revision,kind,'components']);if(context?.failed.has(key))return null
 try{
  // A cold category contains 126 independently checked components in the live
  // library. Keep a real overall bound without forcing healthy cold reads into
  // a much more expensive full-source rebuild after only 2.5 seconds.
  const deadline=context?(context.deadline??=performance.now()+15000):performance.now()+15000
  const metadata=await componentMetadata(userId,deadline),contexts=metadata.map(componentContext)
  if(contexts.some(c=>!c)){context?.failed.add(key);return null}
  const compositionKey=JSON.stringify([userId,kind,sourceHash(JSON.stringify(contexts))]),cached=compositions.get(compositionKey),warm=warmWorkshopCatalog(userId,metadata)
  let imported:OrcbrewEntry[],compactImported=true
  // Another unchanged system may already have paid for the full Workshop
  // catalog. Reuse its exact metadata-validated source without decoding an
  // additional compact copy. Never start/refresh that expensive library here.
  // Keep an exact compact composition if it already exists. Switching to a
  // newly warm full catalogue would recompute every monster fingerprint once.
  if(cached){compositions.delete(compositionKey);compositions.set(compositionKey,cached);imported=cached.entries}
  else if(warm){imported=kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(warm[kind],kind):warm[kind];compactImported=false}
  else{
   const packs=await readComponentCatalogues(userId,kind,metadata,true,deadline)
   if(!packs){context?.failed.add(key);return null}
   const catalog=buildOrcbrewCatalog(packs)
   imported=kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(catalog[kind],kind):catalog[kind]
   rememberComposition(compositionKey,imported)
  }
  const path=kind==='equipment'||kind==='magic-items'?kind:`compendium/${kind}`
  const standard=(localSrdRule(path) as {results?:BrowseEntry[]}|null|undefined)?.results??[]
  const entries:BrowseEntry[]=[...standard,...imported as unknown as BrowseEntry[]]
  if(kind==='equipment'||kind==='magic-items'){
   const items=await CustomContent.find({userId,type:'item'}).maxTimeMS(2000).lean()
   for(const doc of items){const item=prepareItem(doc.data as EquipmentItem);if(!!item.magical===(kind==='magic-items'))entries.push({index:`workshop-item-${doc._id}`,name:item.name,displayName:`${item.name} · My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:item})}
  }
  const edits=await CustomContent.find({userId,type:'compendium-edit','data.kind':kind}).select('data').maxTimeMS(2000).lean()
  const changes=new Map(edits.map(doc=>{const data=doc.data as {index:string;changes:Record<string,unknown>};return [data.index,data.changes] as const}))
  const records=[]
  let warmSources:Map<string,OrcbrewEntry>|undefined
  for(const entry of entries){
   const edit=changes.get(entry.index);let source:BrowseEntry|null=entry
   const needsFullSource=!entry.index.startsWith('homebrew-')||compactImported&&(kind==='monsters'||kind==='equipment'||kind==='magic-items')
   if(edit&&Object.keys(edit).length&&!entry.workshopItem&&needsFullSource){
    // Do not recurse into the pending browse index while resolving an edited
    // imported row. The compact current locator already proves membership.
    // Non-heavy projections and an exact warm Workshop catalogue already carry
    // full rules, so overlay them directly without rereading the owning pack.
    if(entry.index.startsWith('homebrew-')){
     if(warm)warmSources??=new Map(warm[kind].map(e=>[e.index,e]))
     source=warmSources?.get(entry.index) as unknown as BrowseEntry|undefined??
      await readComponentSource(userId,kind,entry.index,entry)??await targetedCompendiumSource(userId,kind,entry.index,entry)
    }else source=await browseEntrySource(userId,kind,entry.index)
   }
   if(source)records.push(compactBrowseEntry(personalEntry(source,edit),kind,compactImported&&kind==='monsters'&&source===entry&&entry.homebrew===true))
  }
  return browseIndex(records,kind)
 }catch(error){context?.failed.add(key);console.warn('Prepared components unavailable; using current reader',{kind,name:(error as Error).name});return null}
}
export async function readPreparedSource(userId:string,revision:string,kind:BrowseKind,index:string,locate:()=>Promise<BrowseEntry|null>,context?:PreparedProbeContext) {
 const key=JSON.stringify([userId,revision,kind,index]);if(context?.failed.has(key))return null
 const locator=await locate();if(!locator)return null
 try{const source=await readComponentSource(userId,kind,index,locator);if(!source)context?.failed.add(key);return source}
 catch(error){context?.failed.add(key);console.warn('Prepared source unavailable; using targeted reader',{kind,name:(error as Error).name});return null}
}
