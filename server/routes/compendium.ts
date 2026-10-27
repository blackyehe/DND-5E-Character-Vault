import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { CustomContent } from '../models/CustomContent'
import { sourceHash, normalizeEditedOrcbrewEntry } from '../lib/orcbrew'
import { compendiumSource } from '../lib/compendium-source'
import { EDITABLE_KINDS, applyEntryChanges, changedEntryFields, cloneEntry, entryProblems, sameEntry, type CompendiumEditState, type CompendiumKind, type EntryData } from '../../shared/compendium-editing'
import { ensureContentIndexes } from '../lib/content-indexes'
import { Character } from '../models/Character'
import { isValidObjectId } from 'mongoose'
import type { Character as CharacterData } from '../../shared/character'
import { characterRuleLibrary } from '../lib/character-rule-library'
import { characterUsesDefinition, reviewedCharacter, characterReviewChanges } from '../lib/compendium-character'
import { savedCharacterOutput } from '../lib/character-output'
import { workshopProblems } from '../../shared/homebrew-workshop'
import { normalizeBuilderEntry } from '../lib/entry-builder-schema'
import { validatedDraft } from '../lib/workshop-schema'
import { itemSchema, prepareItem } from '../lib/inventory'
import type { EquipmentItem } from '../../shared/character'

const router=Router()
router.use(requireAuth)
const bodySchema=z.object({expectedRevision:z.number().int().min(0),expectedSourceHash:z.string().length(64),entry:z.record(z.string(),z.unknown()).optional(),restore:z.boolean().optional()}).strict()
export const editIdentity=(kind:string,index:string)=>sourceHash(`${kind}:${index}`)
export async function compendiumEditState(userId:string|undefined,kind:CompendiumKind,index:string):Promise<CompendiumEditState|null>{
  const source=await compendiumSource(userId,kind,index)
  if(!source)return null
  const doc=await CustomContent.findOne({userId,type:'compendium-edit',sourceHash:editIdentity(kind,index)}).lean()
  const data=doc?.data as {revision:number;changes:EntryData;sourceHash:string}|undefined
  return {kind,index,revision:data?.revision??0,sourceHash:sourceHash(JSON.stringify(source)),sourceChanged:!!data&&Object.keys(data.changes).length>0&&data.sourceHash!==sourceHash(JSON.stringify(source)),source,entry:applyEntryChanges(source,data?.changes??{}),edited:!!data&&Object.keys(data.changes).length>0}
}
router.param('kind',(_req,res,next,value)=>EDITABLE_KINDS.includes(value as CompendiumKind)?next():res.status(404).json({error:'Unknown Compendium category.'}))
router.get('/:kind',async(req,res)=>{
  const docs=await CustomContent.find({userId:req.userId,type:'compendium-edit','data.kind':req.params.kind}).lean()
  res.json(docs.map(doc=>doc.data).filter(data=>Object.keys((data as {changes:EntryData}).changes).length>0))
})
router.get('/:kind/:index',async(req,res)=>{
  const state=await compendiumEditState(req.userId,req.params.kind as CompendiumKind,String(req.params.index))
  return state?res.json(state):res.status(404).json({error:'This source entry is no longer available in your library.'})
})
router.put('/:kind/:index',async(req,res)=>{
  const parsed=bodySchema.safeParse(req.body)
  if(!parsed.success||!parsed.data.restore&&!parsed.data.entry)return res.status(400).json({error:'Supply an entry and its current revision.'})
  const kind=req.params.kind as CompendiumKind,index=String(req.params.index),state=await compendiumEditState(req.userId,kind,index)
  if(!state)return res.status(404).json({error:'This source entry is no longer available in your library.'})
  if(state.revision!==parsed.data.expectedRevision||state.sourceHash!==parsed.data.expectedSourceHash)return res.status(409).json({error:'This entry or its source changed. Your draft is kept; reload the saved version before trying again.'})
  let entry=parsed.data.restore?cloneEntry(state.source):parsed.data.entry!
  const problems=entryProblems(state.source,entry)
  if(problems.length)return res.status(400).json({error:problems[0]})
  if(!parsed.data.restore){try{entry=normalizeBuilderEntry(entry,kind)}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Check the builder fields.'})}}
  if(!parsed.data.restore&&entry.homebrew&&typeof entry.contentKey==='string'&&entry.details&&!sameEntry(entry.details,state.source.details)){
    const normalized=normalizeEditedOrcbrewEntry(kind,entry.contentKey,entry.details)
    for(const [key,value]of Object.entries(normalized))if(!['index','url','homebrew'].includes(key)&&sameEntry(entry[key],state.source[key]))entry[key]=value
  }
  if(kind==='spells'&&!sameEntry(entry.level,state.source.level)&&(!Number.isInteger(entry.level)||Number(entry.level)<0||Number(entry.level)>9))return res.status(400).json({error:'Spell level must be a whole number from 0 to 9.'})
  if(kind==='classes'&&!sameEntry(entry.hit_die,state.source.hit_die)&&entry.hit_die!==undefined&&![4,6,8,10,12].includes(Number(entry.hit_die)))return res.status(400).json({error:'Choose a hit die of d4, d6, d8, d10 or d12.'})
  if((kind==='races'||kind==='subraces')&&!sameEntry(entry.speed,state.source.speed)&&typeof entry.speed==='number'&&(entry.speed<0||entry.speed>1000))return res.status(400).json({error:'Walking speed must be between 0 and 1000 feet.'})
  if(entry.workshopItem&&!sameEntry(entry.workshopItem,state.source.workshopItem)){
    const item=itemSchema.safeParse(prepareItem(entry.workshopItem as EquipmentItem))
    if(!item.success)return res.status(400).json({error:item.error.issues[0]?.message??'Check the item rules.'})
  }
  if(!parsed.data.restore&&entry.workshop){
    const draft=validatedDraft(entry.workshop);if(!draft)return res.status(400).json({error:'Check the Workshop rule fields.'});const errors=workshopProblems(draft);if(errors.length)return res.status(400).json({error:errors[0]})
    if(draft.kind!==({classes:'class',subclasses:'subclass',races:'race',subraces:'race'} as Record<string,string>)[kind])return res.status(400).json({error:'Keep the Workshop rule in its original category.'})
    entry.name=draft.name;entry.description=draft.description
    const traits=draft.features.map(f=>({name:f.name,description:f.choice?`${f.description}\nChoose ${f.choose}: ${f.options.join('; ')}`:f.description,level:f.level}))
    if(kind==='classes'){entry.hit_die=draft.hitDie;entry.homebrew_traits=traits}
    if(kind==='subclasses')entry.traits=traits
    if(kind==='races'||kind==='subraces'){entry.homebrew_traits=traits;entry.speed=draft.race?.speed;entry.size=draft.race?.size}
  }
  if(!parsed.data.restore&&entry.itemView&&entry.workshopItem){
    const view=entry.itemView as EntryData,item=entry.workshopItem as EquipmentItem,old=state.source.workshopItem as EquipmentItem
    const stats=Array.isArray(view.stats)?view.stats as [string,string][]:[]
    const update=(label:string,value:string|undefined)=>{const position=stats.findIndex(row=>row[0]===label);if(position>=0){if(value===undefined)stats.splice(position,1);else stats[position]=[label,value]}else if(value!==undefined)stats.push([label,value])}
    if(!sameEntry(item.weight,old?.weight))update('Weight',`${item.weight} lb`)
    if(!sameEntry(item.value,old?.value))update('Value',item.value?`${item.value.amount} ${item.value.currency}`:undefined)
    if(!sameEntry(item.weapon,old?.weapon)){update('Damage',item.weapon?`${item.weapon.dice} ${item.weapon.damageType}`:undefined);update('Range',item.weapon?.range)}
    if(!sameEntry(item.armor,old?.armor))update(item.armor?.shield?'Shield AC bonus':'Base AC',item.armor?String(item.armor.base):undefined)
    if(!sameEntry(item.description,old?.description)&&typeof item.description==='string')view.description=item.description
    view.stats=stats;view.filterItem=item
  }
  if(typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>200)return res.status(400).json({error:'Give the entry a name of up to 200 characters.'})
  if(Buffer.byteLength(JSON.stringify(entry))>2*1024*1024)return res.status(400).json({error:'Keep this entry below 2 MB.'})
  const changes=changedEntryFields(state.source,entry),data={kind,index,revision:state.revision+1,sourceHash:state.sourceHash,changes}
  const filter={userId:req.userId,type:'compendium-edit' as const,sourceHash:editIdentity(kind,index)}
  try{
    if(state.revision===0){await ensureContentIndexes();await CustomContent.create({...filter,data})}
    else if(!await CustomContent.findOneAndUpdate({...filter,'data.revision':state.revision},{$set:{data}},{new:true}).lean())return res.status(409).json({error:'Another save won the race. Your draft is kept; reload the saved version.'})
  }catch(error){if((error as {code?:number}).code===11000)return res.status(409).json({error:'Another save won the race. Your draft is kept; reload the saved version.'});throw error}
  res.json({...state,revision:data.revision,sourceChanged:false,edited:Object.keys(changes).length>0,entry:applyEntryChanges(state.source,changes)})
})
async function reviewPlan(raw:unknown,state:CompendiumEditState,userId:string|undefined){
  const library=await characterRuleLibrary(userId),original=raw as CharacterData
  const before=reviewedCharacter(original,library.rules,library.initial)
  const previous=before.compendiumRules?.find(d=>d.kind===state.kind&&d.index===state.index)
  const definition={kind:state.kind,index:state.index,revision:state.revision,sourceHash:state.sourceHash,before:previous?.entry??state.source,entry:state.entry}
  const candidate={...before,compendiumRules:[...(before.compendiumRules??[]).filter(d=>d.kind!==state.kind||d.index!==state.index),definition]}
  candidate.meta=JSON.parse(JSON.stringify(candidate.meta)) as CharacterData['meta']
  if(state.kind==='races')candidate.meta.raceIndex=state.index
  if(state.kind==='classes'){
    const row=candidate.meta.classLevels?.find(c=>c.index===state.index||c.name===state.source.name||c.name===previous?.entry.name)
    if(row)row.index=state.index
    if(!candidate.meta.classLevels?.length||candidate.meta.classLevels.length===1)candidate.meta.classIndex=state.index
  }
  if(state.kind==='subclasses'){
    const row=candidate.meta.classLevels?.find(c=>c.subclassIndex===state.index||c.subclass===state.source.name||c.subclass===previous?.entry.name)
    if(row)row.subclassIndex=state.index
    if(!candidate.meta.classLevels?.length||candidate.meta.classLevels.length===1)candidate.meta.subclassIndex=state.index
  }
  const after=reviewedCharacter(candidate,library.rules,library.initial)
  const changes=characterReviewChanges(before,after)
  const warnings=[...new Set(after.homebrew?.conflicts.map(c=>c.message)??[])]
  if(!['classes','subclasses','races','spells','equipment','magic-items'].includes(state.kind))warnings.push('Selected benefits appear in the comparison and apply through the shared rules. Matching saved feature text is updated. Ability-score grants, prerequisites, removed features and player choices still need manual review.')
  if(state.kind==='spells')warnings.push('The reviewed spell definition will be used on this sheet. Known and prepared spells and spent slots stay as saved.')
  if(state.kind==='equipment'||state.kind==='magic-items')warnings.push('Custom item values are kept when they differ from the source. Quantity, equipped state, attunement and personal notes stay as saved.')
  const sourceConfirmation=true
  if(sourceConfirmation)warnings.push('Confirm this is the source intended for this character. Older saved features may only record a name; similarly named versions cannot always be distinguished.')
  const reviewHash=sourceHash(JSON.stringify({changes,homebrew:after.homebrew,definition,updatedAt:original.updatedAt}))
  return {before,after,changes,warnings,sourceConfirmation,reviewHash,alreadyReviewed:previous?.revision===state.revision&&sameEntry(previous.entry,state.entry)}
}
router.get('/:kind/:index/review',async(req,res)=>{
  const state=await compendiumEditState(req.userId,req.params.kind as CompendiumKind,String(req.params.index))
  if(!state)return res.status(404).json({error:'Source entry not found.'})
  const docs=await Character.find({userId:req.userId}).lean(),rows=[]
  for(const raw of docs){
    const definition={kind:state.kind,index:state.index,revision:state.revision,before:state.source,entry:state.entry}
    if(!characterUsesDefinition(raw as unknown as CharacterData,definition))continue
    const plan=await reviewPlan(raw,state,req.userId)
    rows.push({id:String(raw._id),name:(raw as unknown as CharacterData).meta.name,updatedAt:raw.updatedAt,...Object.fromEntries(Object.entries(plan).filter(([key])=>key!=='before'&&key!=='after'))})
  }
  res.json({revision:state.revision,characters:rows})
})
router.post('/:kind/:index/review/:characterId',async(req,res)=>{
  const parsed=z.object({expectedRevision:z.number().int().min(0),expectedUpdatedAt:z.string(),reviewHash:z.string().length(64),confirmedSource:z.boolean()}).strict().safeParse(req.body)
  if(!parsed.success||!isValidObjectId(req.params.characterId))return res.status(400).json({error:'Supply the character and the reviewed revision.'})
  const state=await compendiumEditState(req.userId,req.params.kind as CompendiumKind,String(req.params.index))
  if(!state)return res.status(404).json({error:'Source entry not found.'})
  const raw=await Character.findOne({_id:req.params.characterId,userId:req.userId}).lean()
  if(!raw)return res.status(404).json({error:'Character not found.'})
  if(state.revision!==parsed.data.expectedRevision||String(raw.updatedAt.toISOString())!==parsed.data.expectedUpdatedAt)return res.status(409).json({error:'The entry or character changed. Refresh the review before applying it.'})
  const plan=await reviewPlan(raw,state,req.userId)
  if(plan.reviewHash!==parsed.data.reviewHash)return res.status(409).json({error:'The proposed changes changed. Refresh the review before applying them.'})
  if(plan.sourceConfirmation&&!parsed.data.confirmedSource)return res.status(400).json({error:'Confirm this is the intended source for the character.'})
  const {meta,features,equipment,combat,abilities,saves,skills,resources,spellcasting,proficiencies,homebrew,compendiumRules}=plan.after
  const saved=await Character.findOneAndUpdate({_id:raw._id,userId:req.userId,updatedAt:raw.updatedAt},{$set:{meta,features,equipment,combat,abilities,saves,skills,resources,spellcasting,proficiencies,homebrew,compendiumRules}},{new:true,runValidators:true}).lean()
  if(!saved)return res.status(409).json({error:'The character changed while applying. Refresh the review; no changes were applied.'})
  res.json({character:savedCharacterOutput(saved),message:'Reviewed changes applied to this character.'})
})
export default router
