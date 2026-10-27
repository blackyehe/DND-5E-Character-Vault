import { CustomContent } from '../models/CustomContent'
import { Character } from '../models/Character'
import { buildOrcbrewCatalog, sourceHash, type CatalogPack } from './orcbrew'
import { parsedPack } from './orcbrew-library'
import { validatedDraft } from './workshop-schema'
import type { Character as CharacterData } from '../../shared/character'
import type { PublishedWorkshopRule, WorkshopDraft } from '../../shared/homebrew-workshop'
import { workshopFromEntry } from '../../shared/homebrew-workshop'
import { readPackDocuments } from './pack-source'
import { reviewedCharacter, reviewedWorkshopRules } from './compendium-character'

type LibraryData=Awaited<ReturnType<typeof buildLibrary>>
const libraries=new Map<string,{signature:string;value:LibraryData}>()
const pendingLibraries=new Map<string,Promise<LibraryData>>()
export async function workshopRevision(userId:string|undefined) {
  const revisions=await CustomContent.find({userId,type:'orcbrew'}).select('_id updatedAt sourceHash data.includeDisabled').sort({_id:1}).lean()
  return sourceHash(JSON.stringify(revisions))
}
/** Check small revision records on every request; download and parse packs only on changes. */
export async function workshopLibrary(userId:string|undefined):Promise<LibraryData> {
  const key=String(userId)
  const pending=pendingLibraries.get(key);if(pending)return pending
  const task=(async()=>{
    const started=performance.now()
    const revisions=await CustomContent.find({userId,type:'orcbrew'}).select('_id updatedAt sourceHash data.includeDisabled').sort({_id:1}).lean()
    const signature=JSON.stringify(revisions)
    const previous=libraries.get(key)
    if(previous?.signature===signature){libraries.delete(key);libraries.set(key,previous);if(performance.now()-started>1000)console.info('Library read timing',{cached:true,revisionCheckMs:Math.round(performance.now()-started)});return previous.value}
    const checked=performance.now()
    console.info('Library revision timing',{revisionCheckMs:Math.round(checked-started),packCount:revisions.length})
    const value=await buildLibrary(userId)
    console.info('Library read timing',{cached:false,revisionCheckMs:Math.round(checked-started),assembleMs:Math.round(performance.now()-checked)})
    if(libraries.size>=4)libraries.delete(libraries.keys().next().value!)
    libraries.set(key,{signature,value});return value
  })()
  pendingLibraries.set(key,task)
  try{return await task}finally{if(pendingLibraries.get(key)===task)pendingLibraries.delete(key)}
}
async function buildLibrary(userId:string|undefined) {
  const readStarted=performance.now()
  const docs=await readPackDocuments(userId)
  console.info('Library source timing',{sourceReadMs:Math.round(performance.now()-readStarted),packCount:docs.length})
  const packs:CatalogPack[]=[],warnings:string[]=[]
  for(const doc of docs){try{const data=doc.data as {filename:string;includeDisabled?:boolean};packs.push({id:String(doc._id),filename:data.filename,includeDisabled:data.includeDisabled,parsed:parsedPack(data)})}catch{warnings.push(`Could not read ${(doc.data as {filename:string}).filename}.`)}}
  const catalog=buildOrcbrewCatalog(packs),rules:PublishedWorkshopRule[]=[],initial:Record<string,WorkshopDraft>={}
  for(const entry of [...catalog.classes,...catalog.subclasses,...catalog.races]){
    const raw=entry.details as Record<string,unknown>,draft=validatedDraft(raw[':codex/workshop'])
    if(!draft)continue
    const parent=catalog.classes.find(e=>e.index===draft.parentClass||e.contentKey===String(raw[':class']).replace(/^:/,''))
    const rule:PublishedWorkshopRule={id:draft.id,revision:Number(raw[':codex/revision'])||1,index:entry.index,previousIndexes:Array.isArray(raw[':codex/previous-indexes'])?raw[':codex/previous-indexes'] as string[]:[],previousNames:Array.isArray(raw[':codex/previous-names'])?raw[':codex/previous-names'] as string[]:[],parentClassName:parent?.name??String(raw[':class']??draft.parentClass).replace(/^:/,''),draft}
    const prior=rules.find(r=>r.id===rule.id)
    if(!prior||prior.revision<rule.revision){if(prior)rules.splice(rules.indexOf(prior),1);rules.push(rule);initial[rule.id]=validatedDraft(raw[':codex/baseline'])??draft}
  }
  // Imported races already carry readable traits and property grants. Resolve them
  // for existing sheets too, without requiring a first manual Workshop publication.
  for(const entry of catalog.races){
    if(rules.some(r=>r.draft.kind==='race'&&(r.index===entry.index||r.previousIndexes.includes(entry.index))))continue
    const draft=workshopFromEntry(entry,'race')
    for(const spell of draft.race?.spells??[]){const candidates=catalog.spells.filter(s=>s.contentKey===spell.index),sameSource=candidates.filter(s=>s.sourcePack===entry.sourcePack);const match=sameSource.length===1?sameSource[0]:candidates.length===1?candidates[0]:undefined;if(match){spell.index=match.index;spell.name=match.name}}
    rules.push({id:draft.id,revision:0,index:entry.index,previousIndexes:[],previousNames:[],draft})
    initial[draft.id]=draft
  }
  return {docs,packs,catalog,rules,initial,warnings}
}
export type WorkshopLibrary=Awaited<ReturnType<typeof workshopLibrary>>
export async function resolveWorkshopCharacter(character:unknown,userId:string|undefined,library?:WorkshopLibrary) {
  const data=library??await workshopLibrary(userId)
  const resolved=reviewedCharacter(character as CharacterData,data.rules,data.initial)
  const knownRules=reviewedWorkshopRules(resolved,data.rules,data.initial).rules
  if(resolved.homebrew){
    const restored=(id:string)=>id.startsWith('missing-rule:')&&knownRules.some(r=>id===`missing-rule:${r.id}`)
    resolved.homebrew.conflicts=resolved.homebrew.conflicts.filter(c=>!restored(c.id))
    resolved.homebrew.acknowledged=resolved.homebrew.acknowledged.filter(id=>!restored(id))
  }
  for(const binding of resolved.homebrew?.bindings??[])if(!knownRules.some(r=>r.id===binding.ruleId)){
    const id=`missing-rule:${binding.ruleId}`
    if(!resolved.homebrew!.acknowledged.includes(id)&&!resolved.homebrew!.conflicts.some(c=>c.id===id))resolved.homebrew!.conflicts.push({id,message:`${binding.rule.name}'s source pack is unavailable. The last saved rules are still in use.`})
  }
  return resolved
}
/** Compare-and-set prevents rule publishing from overwriting a concurrent play action. */
export async function synchronizeWorkshopCharacters(userId:string|undefined,library:WorkshopLibrary) {
  const docs=await Character.find({userId}).lean();let updated=0,review=0,deferred=0
  for(const original of docs){
    let current=original,saved=false
    for(let attempt=0;attempt<3;attempt++){
      const resolved=reviewedCharacter(current as unknown as CharacterData,library.rules,library.initial)
      if(JSON.stringify(resolved)===JSON.stringify(current)){saved=true;break}
      const result=await Character.updateOne({_id:current._id,userId,updatedAt:current.updatedAt},{$set:{meta:resolved.meta,features:resolved.features,resources:resolved.resources,spellcasting:resolved.spellcasting,proficiencies:resolved.proficiencies,saves:resolved.saves,skills:resolved.skills,homebrew:resolved.homebrew,'combat.hpMax':resolved.combat.hpMax,'combat.speed':resolved.combat.speed}})
      if(result.modifiedCount){updated++;if(resolved.homebrew?.conflicts.length)review++;saved=true;break}
      const fresh=await Character.findOne({_id:current._id,userId}).lean();if(!fresh){saved=true;break}current=fresh
    }
    if(!saved)deferred++
  }
  return {updated,review,deferred}
}
