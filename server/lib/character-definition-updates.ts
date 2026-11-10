import type {Character as CharacterData,EquipmentItem} from '../../shared/character'
import {sameEntry,type CompendiumKind,type EntryData} from '../../shared/compendium-editing'
import {characterRuleLibrary} from './character-rule-library'
import {characterRuleExtraKinds} from './workshop-rules'
import {activeWorkshopEntries} from './workshop-schema'
import {CustomContent} from '../models/CustomContent'
import {prepareItem} from './inventory'
import {compendiumSource} from './compendium-source'
import {characterUsesDefinition,reviewedCharacter,characterReviewChanges} from './compendium-character'
import {effectiveDefinitions,sameDefinition} from './definition-editions'
import {sourceHash} from './orcbrew'

export interface DefinitionUpdate {kind:CompendiumKind;index:string;name:string;missing?:boolean}
/** Read only sources this sheet uses. No character or play-state writes. */
export async function characterDefinitionUpdates(raw:CharacterData,owner:string|undefined):Promise<DefinitionUpdate[]>{
 const library=await characterRuleLibrary(owner,characterRuleExtraKinds(raw)),before=reviewedCharacter(raw,library.rules,library.initial)
 const sources:{kind:CompendiumKind;source:EntryData}[]=[]
 for(const [kind,entries]of Object.entries(library.catalog)){
  const rows=['classes','subclasses','races'].includes(kind)?activeWorkshopEntries(entries,kind as 'classes'|'subclasses'|'races'):entries
  for(const source of rows)sources.push({kind:kind as CompendiumKind,source})
 }
 const templates=[...new Set(raw.equipment.map(i=>i.templateId).filter((id):id is string=>!!id))]
 if(templates.length){const docs=await CustomContent.find({_id:{$in:templates},userId:owner,type:'item'}).lean();for(const doc of docs){const item=prepareItem(doc.data as EquipmentItem);sources.push({kind:item.magical?'magic-items':'equipment',source:{index:`workshop-item-${doc._id}`,name:item.name,displayName:`${item.name} · My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:item}})}}
 // Standard sources only need a lookup when this owner has actually edited them.
 const edits=await CustomContent.find({userId:owner,type:'compendium-edit'}).select('data.kind data.index').lean()
 for(const doc of edits){const {kind,index}=doc.data as {kind:CompendiumKind;index:string};if(index.startsWith('homebrew-')||index.startsWith('workshop-item-'))continue
  const definition={kind,index,revision:0,before:{index,name:index},entry:{}}
  if(!characterUsesDefinition(raw,definition,false))continue
  const source=await compendiumSource(owner,kind,index);if(source)sources.push({kind,source})
 }
 const updates:DefinitionUpdate[]=[],found=new Set<string>()
 const applicable=sources.filter(({kind,source})=>characterUsesDefinition(raw,{kind,index:String(source.index),revision:0,before:source,entry:source},false)),editions=await effectiveDefinitions(owner,applicable)
 for(const [position,{kind,source}]of applicable.entries()){
  const index=String(source.index),definition={kind,index,revision:0,before:source,entry:source}
  if(!characterUsesDefinition(raw,definition))continue
  const previous=raw.compendiumRules?.find(d=>sameDefinition(d,kind,index,source))
  if(previous)found.add(`${previous.kind}:${previous.index}`)
  const effective=editions[position]!
  const comparable=(entry:EntryData)=>{const copy={...entry};if(!previous?.entry.details)delete copy.details;return copy}
  if(previous&&(previous.revision===effective.revision&&previous.sourceHash===sourceHash(JSON.stringify(source))||sameEntry(comparable(previous.entry),comparable(effective.entry))))continue
  const candidate={...before,compendiumRules:[...(before.compendiumRules??[]).filter(d=>!sameDefinition(d,kind,index,source)),{...definition,revision:effective.revision,before:previous?.entry??effective.previousSource??source,entry:effective.entry}]}
  const after=reviewedCharacter(candidate,library.rules,library.initial)
  if(previous||characterReviewChanges(before,after).length)updates.push({kind,index,name:String(effective.entry.name??source.name)})
 }
 for(const definition of raw.compendiumRules??[]){if(!definition.index.startsWith('homebrew-')&&!definition.index.startsWith('workshop-item-')||found.has(`${definition.kind}:${definition.index}`)||!characterUsesDefinition(raw,{...definition,before:definition.entry},false))continue
  updates.push({kind:definition.kind,index:definition.index,name:String(definition.entry.name),missing:true})
 }
 return updates
}
