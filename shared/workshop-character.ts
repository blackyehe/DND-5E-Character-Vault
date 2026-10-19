import type { Character, CharacterResource } from './character'
import { abilityMod } from '../src/lib/calc'
import { scheduleAt, workshopResourceAt, workshopSlots, type PublishedWorkshopRule, type WorkshopDraft } from './homebrew-workshop'
import { applyRaceWorkshopRules } from './workshop-race'

export const ruleName=(s:string)=>s.replace(/\s*[·(—].*$/,'').trim().toLowerCase()
export const choiceKey=(ruleId:string,featureId:string)=>`${ruleId}:${featureId}`
export function boundClassLevel(c:Pick<Character,'meta'>,className:string) {
  return c.meta.classLevels?.length?c.meta.classLevels.find(e=>ruleName(e.name)===ruleName(className))?.level??0:c.meta.klass.includes('/')?0:ruleName(c.meta.klass)===ruleName(className)?c.meta.level:0
}
const featureDescription=(f:WorkshopDraft['features'][number])=>f.choice?`${f.description}\nChoose ${f.choose}: ${f.options.join('; ')}`:f.description
const resourceAlias=(name:string)=>/^shadow points$/i.test(name)?'auto:shadow':/^mantle of darkness$/i.test(name)?'auto:mantle-darkness':/^rift points/i.test(name)?'auto:rift':/^riftborne bonus slot/i.test(name)?'auto:rift-slot':undefined
/** Reconcile authored rules without resetting HP, spent uses, inventory, or selected choices. */
export function applyWorkshopRules(character:Character,rules:PublishedWorkshopRule[]=[],initial:Record<string,WorkshopDraft>={}):Character {
  const races=character.homebrew?.bindings.filter(b=>b.rule.kind==='race')??[]
  const input=JSON.parse(JSON.stringify(character)) as Character
  if(input.homebrew)input.homebrew.bindings=input.homebrew.bindings.filter(b=>b.rule.kind!=='race')
  const result=applyClassWorkshopRules(input,rules.filter(r=>r.draft.kind!=='race'),initial)
  if(races.length){result.homebrew??={bindings:[],choices:{},conflicts:[],acknowledged:[]};result.homebrew.bindings.push(...races)}
  return applyRaceWorkshopRules(result,rules,initial)
}
function applyClassWorkshopRules(character:Character,rules:PublishedWorkshopRule[]=[],initial:Record<string,WorkshopDraft>={}):Character {
  const c=JSON.parse(JSON.stringify(character)) as Character
  if(!c.homebrew?.bindings.length&&!rules.length)return c
  c.homebrew??={bindings:[],choices:{},conflicts:[],acknowledged:[]}
  const state=c.homebrew
  state.choices??={};state.conflicts??=[];state.acknowledged??=[]
  const conflict=(id:string,message:string)=>{if(!state.acknowledged.includes(id)&&!state.conflicts.some(v=>v.id===id))state.conflicts.push({id,message})}
  const clear=(id:string)=>{state.conflicts=state.conflicts.filter(v=>v.id!==id)}
  const candidates=new Map(state.bindings.filter(b=>{
    const explicit=b.rule.kind==='subclass'?c.meta.subclassIndex:c.meta.classLevels?.find(e=>ruleName(e.name)===ruleName(b.className))?.index??((c.meta.classLevels?.length??0)>1?undefined:c.meta.classIndex)
    const latest=rules.find(r=>r.id===b.ruleId)
    if(!explicit||explicit===b.index||explicit===latest?.index||latest?.previousIndexes.includes(explicit))return true
    c.features=c.features.flatMap(f=>{
      if(f.ruleId!==b.ruleId)return [f]
      const original=b.rule.features.find(v=>v.id===f.featureId)
      if(original&&f.name===original.name&&(f.description===original.description||f.description===featureDescription(original))||f.featureId==='attacks')return []
      conflict(`detached-feature:${b.ruleId}:${f.featureId}`,`${f.name} was kept as a custom feature after changing the linked class definition.`)
      return [{...f,ruleId:undefined,featureId:undefined}]
    })
    c.resources=c.resources?.flatMap(r=>r.ruleId!==b.ruleId?[r]:r.used?[{...r,ruleId:undefined,automatic:false}]:[])
    return false
  }).map(b=>[b.ruleId,b]))
  for(const rule of rules){
    const existing=candidates.get(rule.id)
    if(existing){candidates.set(rule.id,{...existing,rule:existing.rule});continue}
    const names=[rule.draft.name,...rule.previousNames].map(ruleName)
    const classEntry=c.meta.classLevels?.find(e=>names.includes(ruleName(e.name)))
    const matches=rule.draft.kind==='class'?(classEntry?.name??(!c.meta.klass.includes('/')&&names.includes(ruleName(c.meta.klass))?c.meta.klass:'')):(names.includes(ruleName(c.meta.subclass))?c.meta.classLevels?.find(e=>e.index===rule.draft.parentClass||ruleName(e.name)===ruleName(rule.parentClassName??rule.draft.parentClass))?.name??(c.meta.classLevels?.length===1?c.meta.classLevels[0]!.name:!c.meta.klass.includes('/')?c.meta.klass:''):'')
    const index=rule.draft.kind==='class'?(classEntry?.index??((c.meta.classLevels?.length??0)>1?undefined:c.meta.classIndex)):c.meta.subclassIndex
    if(!matches&&index!==rule.index&&!rule.previousIndexes.includes(index??''))continue
    const ambiguous=rules.filter(other=>other.id!==rule.id&&other.draft.kind===rule.draft.kind&&[other.draft.name,...other.previousNames].some(n=>names.includes(ruleName(n))))
    if(!index&&ambiguous.length||index&&index!==rule.index&&rules.filter(other=>other.index===index||other.previousIndexes.includes(index)).length>1){conflict(`ambiguous:${rule.draft.kind}:${ruleName(rule.draft.name)}`,`${rule.draft.name}: more than one saved definition matches this character. Choose the correct rule in Edit character.`);continue}
    if(index&&index!==rule.index&&!rule.previousIndexes.includes(index))continue
    const className=matches||(rule.draft.kind==='class'?rule.draft.name:c.meta.klass)
    candidates.set(rule.id,{ruleId:rule.id,revision:0,index:index??rule.previousIndexes[0]??rule.index,className,rule:initial[rule.id]??rule.draft})
  }
  if(!candidates.size&&!state.conflicts.length&&!character.homebrew)return JSON.parse(JSON.stringify(character)) as Character
  for(const binding of candidates.values()){
    const published=rules.find(r=>r.id===binding.ruleId)
    const d=published?.draft??binding.rule,old=binding.rule,revision=published?.revision??binding.revision
    const l=boundClassLevel(c,binding.className)
    if(l===0){conflict(`class:${binding.ruleId}`,`${d.name}: the linked class is no longer on this character. Review the class link and any retained choices.`);continue}
    const revisionKey=`${binding.ruleId}:${revision}`
    const gained=d.features.filter(f=>f.level<=l)
    for(const oldFeature of old.features){
      const live=c.features.find(f=>f.ruleId===binding.ruleId&&f.featureId===oldFeature.id)??(binding.revision===0?c.features.find(f=>(!f.origin||f.origin==='other'||f.origin===d.kind)&&ruleName(f.name)===ruleName(oldFeature.name)):undefined)
      if(!live)continue
      live.ruleId=binding.ruleId;live.featureId=oldFeature.id
      const next=gained.find(f=>f.id===oldFeature.id)
      const unchanged=live.name===oldFeature.name&&(live.description===featureDescription(oldFeature)||live.description===oldFeature.description)
      if(!next&&oldFeature.choice&&(state.choices[choiceKey(binding.ruleId,oldFeature.id)]?.length??0)>0)conflict(`choice-removed:${revisionKey}:${oldFeature.id}`,`${oldFeature.name} is no longer offered at this level. Saved selections: ${state.choices[choiceKey(binding.ruleId,oldFeature.id)]!.join(', ')}. They have been preserved for review.`)
      if(!next){if(unchanged)c.features=c.features.filter(f=>f!==live);else conflict(`feature-removed:${revisionKey}:${oldFeature.id}`,`${live.name} was removed or moved above this level. Your edited version has been kept.`);continue}
      if(unchanged){Object.assign(live,{name:next.name,description:featureDescription(next),level:next.level,origin:d.kind==='race'?'racial':d.kind})}
      else if(revision!==binding.revision)conflict(`feature-edited:${revisionKey}:${next.id}`,`${next.name} changed in the class. Your character's edited description has been kept; compare it in Edit character.`)
    }
    for(const f of gained){
      if(!c.features.some(v=>v.ruleId===binding.ruleId&&v.featureId===f.id)){
        const imported=c.features.find(v=>!v.ruleId&&ruleName(v.name)===ruleName(f.name)&&(v.origin===d.kind||v.origin==='other'||!v.origin))
        if(imported){imported.ruleId=binding.ruleId;imported.featureId=f.id}
        else c.features.push({ruleId:binding.ruleId,featureId:f.id,name:f.name,description:featureDescription(f),level:f.level,origin:d.kind==='race'?'racial':d.kind})
      }
      if(f.choice){const selected=state.choices[choiceKey(binding.ruleId,f.id)]??[]
        const feature=c.features.find(v=>v.ruleId===binding.ruleId&&v.featureId===f.id);if(feature)feature.selectedOptions=[...selected]
        if(selected.length!==f.choose||selected.some(v=>!f.options.includes(v)))conflict(`choice:${revisionKey}:${f.id}`,f.options.length?`${f.name}: choose ${f.choose} option${f.choose===1?'':'s'} in Edit character. Existing selections have been kept.`:`${f.name} uses an imported choice list. Define its options in the Workshop, or review the existing character selections.`)
        else clear(`choice:${revisionKey}:${f.id}`)
      }
    }
    const saved=c.resources??[],nextResources:CharacterResource[]=[]
    for(const r of d.resources.filter(r=>r.level<=l)){
      const id=`workshop:${binding.ruleId}:${r.id}`
      const previous=saved.find(v=>v.id===id)??saved.find(v=>!v.ruleId&&(v.id===resourceAlias(r.name)||ruleName(v.name)===ruleName(r.name)))
      const calculated=workshopResourceAt(r,l,c.abilities,c.meta.level),used=previous?.used??0
      if(used>calculated.maximum)conflict(`spent:${revisionKey}:${r.id}`,`${r.name}: ${used} spent uses exceed the new maximum of ${calculated.maximum}. Spent uses have been preserved.`)
      else clear(`spent:${revisionKey}:${r.id}`)
      nextResources.push({id,ruleId:binding.ruleId,name:r.name,max:calculated.maximum,used,recovery:r.recovery,unlimited:calculated.unlimited,notes:r.notes})
    }
    for(const retired of saved.filter(r=>r.ruleId===binding.ruleId&&!nextResources.some(n=>n.id===r.id))){if(retired.used){conflict(`resource-removed:${revisionKey}:${retired.id}`,`${retired.name} was removed. Its spent-use record is kept as a manual tracker.`);nextResources.push({...retired,ruleId:undefined,automatic:false,scaling:undefined})}}
    c.resources=[...saved.filter(r=>r.ruleId!==binding.ruleId&&!nextResources.some(n=>n.id===r.id||!r.ruleId&&(ruleName(n.name)===ruleName(r.name)||r.id===resourceAlias(n.name)))),...nextResources]
    if(d.kind==='class'){
      for(const key of d.savingThrows)c.saves[key]=true
      if(revision!==binding.revision){for(const key of old.savingThrows.filter(k=>!d.savingThrows.includes(k)))conflict(`save:${revisionKey}:${key}`,`${key.toUpperCase()} saving throw proficiency was removed from the class. It has been retained in case another feature grants it.`)
        for(const group of ['armor','weapons','tools'] as const){c.proficiencies[group]=[...new Set([...c.proficiencies[group],...d[group]])];for(const removed of old[group].filter(v=>!d[group].includes(v)))if(c.proficiencies[group].includes(removed))conflict(`prof:${revisionKey}:${group}:${removed}`,`${removed} is no longer granted by the class. It has been kept for review because another source may grant it.`)}
        if(old.hitDie!==d.hitDie){const expected=old.hitDie+abilityMod(c.abilities.con)+(l-1)*(Math.floor(old.hitDie/2)+1+abilityMod(c.abilities.con));if(c.meta.classLevels?.length!==undefined&&c.meta.classLevels.length>1||c.combat.hpMax!==expected)conflict(`hp:${revisionKey}`,`${d.name}'s hit die changed to d${d.hitDie}. Review this character's custom maximum HP; current HP has been preserved.`);else c.combat.hpMax+=d.hitDie-old.hitDie+(l-1)*(Math.floor(d.hitDie/2)-Math.floor(old.hitDie/2))}
        if((old.skillCount!==d.skillCount||JSON.stringify(old.skillOptions)!==JSON.stringify(d.skillOptions)||old.expertiseCount!==d.expertiseCount)&&binding.revision!==0)conflict(`skills:${revisionKey}`,`${d.name}'s skill or expertise allowances changed. Your skill choices have been kept for review.`)
        if(JSON.stringify(old.magic)!==JSON.stringify(d.magic)&&binding.revision!==0&&c.spellcasting.known.length)conflict(`spells:${revisionKey}`,`${d.name}'s spell allowances or list changed. Your known and prepared spells have been kept; review their choices.`)
        if(JSON.stringify(old.asiLevels)!==JSON.stringify(d.asiLevels))conflict(`asi:${revisionKey}`,`${d.name}'s ability increase / feat levels changed. Existing scores and feats have been kept; review their allowances.`)
      }
      if(ruleName(binding.className)===ruleName(c.meta.klass))c.meta.klass=d.name
      const entry=c.meta.classLevels?.find(e=>ruleName(e.name)===ruleName(binding.className));if(entry){entry.name=d.name;entry.index=published?.index??binding.index}
      if((c.meta.classLevels?.length??0)<=1)c.meta.classIndex=published?.index??binding.index
      for(const other of candidates.values())if(other.ruleId!==binding.ruleId&&other.rule.kind==='subclass'&&ruleName(other.className)===ruleName(binding.className))other.className=d.name
    }else {c.meta.subclass=d.name;c.meta.subclassIndex=published?.index??binding.index}
    if(d.magic.enabled){
      const castingBindings=[...candidates.values()].filter(b=>(rules.find(r=>r.id===b.ruleId)?.draft??b.rule).magic.enabled)
      if((c.meta.classLevels?.length??0)>1||castingBindings.length>1&&new Set(castingBindings.map(b=>ruleName(b.className))).size>1)conflict(`multiclass:${revisionKey}`,'This character has multiple classes. Existing combined slots have been kept; review multiclass progression in Edit character.')
      else {const slots=workshopSlots(d,l);c.spellcasting.ability=d.magic.ability;c.spellcasting.slotRule={progression:d.magic.progression,className:d.kind==='class'?d.name:binding.className,workshopId:binding.ruleId};for(const [key,max]of Object.entries(slots)){const used=c.spellcasting.slots[key]?.used??0;if(used>max)conflict(`slot:${revisionKey}:${key}`,`Level ${key.slice(1)} slots: ${used} spent exceeds the new maximum of ${max}. Spent slots have been preserved.`);c.spellcasting.slots[key]={max,used,recovery:d.magic.progression==='pact'?'short':'long'}}}
    }else if(c.spellcasting.slotRule?.workshopId===binding.ruleId){for(const [key,s]of Object.entries(c.spellcasting.slots)){if(s.used)conflict(`slot-removed:${revisionKey}:${key}`,`Spellcasting was removed. ${s.used} spent level ${key.slice(1)} slots are retained for review.`);s.max=0}delete c.spellcasting.slotRule}
    if(c.combat.hpCurrent>c.combat.hpMax)conflict(`hp-current:${revisionKey}`,'Current HP is higher than the revised maximum. Current HP has been preserved for review.')
    const attacks=scheduleAt(d.attacks,l);if(attacks>1&&!c.features.some(f=>f.ruleId===binding.ruleId&&f.featureId==='attacks'))c.features.push({ruleId:binding.ruleId,featureId:'attacks',name:'Attacks per Attack action',description:`You can make ${attacks} attacks when you take the Attack action.`,origin:d.kind==='race'?'racial':d.kind})
    else {const feature=c.features.find(f=>f.ruleId===binding.ruleId&&f.featureId==='attacks');if(feature){if(attacks<=1)c.features=c.features.filter(f=>f!==feature);else feature.description=`You can make ${attacks} attacks when you take the Attack action.`}}
    candidates.set(binding.ruleId,{ruleId:binding.ruleId,revision,index:published?.index??binding.index,className:d.kind==='class'?d.name:binding.className,rule:d})
  }
  state.bindings=[...candidates.values()]
  for(const r of c.resources??[]){const collisions=(c.resources??[]).filter(other=>other.ruleId&&other.ruleId!==r.ruleId&&ruleName(other.name)===ruleName(r.name));if(r.ruleId&&collisions.length)conflict(`resource-name:${ruleName(r.name)}`,`${r.name} is supplied by more than one class or subclass. Their pools and spent uses remain separate; give the trackers distinct names in the Workshop.`)}
  state.conflicts=state.conflicts.filter(v=>!state.acknowledged.includes(v.id))
  return c
}
