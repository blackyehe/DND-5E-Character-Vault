import { CustomContent } from '../models/CustomContent'
import { Character } from '../models/Character'
import { buildOrcbrewCatalog, sourceHash, type CatalogPack } from './orcbrew'
import { parsedPack } from './orcbrew-library'
import { characterRules, type CharacterRuleLibrary } from './workshop-rules'
import type { Character as CharacterData } from '../../shared/character'
import { readPackDocuments } from './pack-source'
import { reviewedCharacter, reviewedWorkshopRules } from './compendium-character'

type LibraryData=Awaited<ReturnType<typeof buildLibrary>>
const libraries=new Map<string,{signature:string;value:LibraryData}>()
const pendingLibraries=new Map<string,Promise<LibraryData>>()
type PackIdentity={_id:unknown;sourceHash?:unknown;updatedAt?:unknown;data?:{filename?:unknown;includeDisabled?:unknown}}
/** Read-only reuse of an already resident, exact-source catalog. No query,
 * build, LRU change, save or character synchronization is performed here. */
export function warmWorkshopCatalog(userId:string,current:readonly PackIdentity[]){
  const existing=libraries.get(userId)?.value
  if(!existing||existing.docs.length!==current.length)return null
  for(let i=0;i<current.length;i++){
    const expected=current[i]!,actual=existing.docs[i] as unknown as PackIdentity
    if(String(actual._id)!==String(expected._id)||actual.sourceHash!==expected.sourceHash||
      !(actual.updatedAt instanceof Date)||!(expected.updatedAt instanceof Date)||actual.updatedAt.getTime()!==expected.updatedAt.getTime()||
      actual.data?.filename!==expected.data?.filename||actual.data?.includeDisabled!==expected.data?.includeDisabled)return null
  }
  return existing.catalog
}
/** Exact resident full-library reuse by the scoped character reader. */
export function warmWorkshopRules(userId:string,signature:string):CharacterRuleLibrary|null {
  const entry=libraries.get(userId)
  if(entry?.signature!==signature)return null
  libraries.delete(userId);libraries.set(userId,entry)
  return entry.value
}
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
  const catalog=buildOrcbrewCatalog(packs),{rules,initial}=characterRules(catalog)
  return {docs,packs,catalog,rules,initial,warnings}
}
export type WorkshopLibrary=Awaited<ReturnType<typeof workshopLibrary>>
export async function resolveWorkshopCharacter(character:unknown,userId:string|undefined,library?:Pick<CharacterRuleLibrary,'rules'|'initial'>) {
  const data=library??await (await import('./character-rule-library')).characterRuleLibrary(userId)
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
