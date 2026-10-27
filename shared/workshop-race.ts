import type { Character, CharacterFeature, CharacterResource } from './character'
import { grantedBenefitSpells } from './rule-benefits'
import { workshopResourceAt, type PublishedWorkshopRule, type WorkshopDraft } from './homebrew-workshop'

const nameKey=(value:string)=>value.trim().toLowerCase()
const addTraining=(existing:string[],grants:string[],group:string)=>{
  const key=(value:string)=>nameKey(value).replace(/^all /,'').replace(group==='armor'?/ armou?r$/:group==='weapons'?/ weapons?$/:/$^/,'')
  const seen=new Set(existing.map(key));return [...existing,...grants.filter(v=>{if(seen.has(key(v)))return false;seen.add(key(v));return true})]
}
const featureObjectId=(ruleId:string,featureId:string)=>[2166136261,2246822507,3266489909].map(seed=>{let hash=seed;for(const char of `${ruleId}:${featureId}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash>>>0).toString(16).padStart(8,'0')}).join('')
export function raceFeatures(d:WorkshopDraft):CharacterFeature[] {
  const r=d.race
  const features:CharacterFeature[]=d.features.map(f=>({featureId:f.id,name:f.name,description:f.choice?`${f.description}\nChoose ${f.choose}: ${f.options.join('; ')}`:f.description,level:f.level,origin:'racial'}))
  if(!r)return features
  const add=(id:string,name:string,description:string,level=1)=>{if(description)features.push({featureId:`race:${id}`,name,description,origin:'racial',level})}
  add('size','Size',r.size)
  add('bonuses','Racial ability bonuses',Object.entries(r.abilityBonuses).filter(([,value])=>value).map(([key,value])=>`${key.toUpperCase()} ${value>=0?'+':''}${value}`).join(', '))
  add('vision','Darkvision',r.darkvision?`Darkvision: ${r.darkvision} feet.`:'')
  add('resistance','Damage resistances',r.resistances.join(', '))
  add('immunity','Damage immunities',r.immunities.join(', '))
  add('armour','Natural armour',r.naturalArmor)
  add('training','Racial training',[
    d.armor.length?`Armour: ${d.armor.join(', ')}`:'',d.weapons.length?`Weapons: ${d.weapons.join(', ')}`:'',
    d.tools.length?`Tools: ${d.tools.join(', ')}`:'',r.skills.length?`Skills: ${r.skills.join(', ')}`:'',r.languages.length?`Languages: ${r.languages.join(', ')}`:'',
  ].filter(Boolean).join('\n'))
  for(const s of r.spells)add(`spell:${s.id}`,`Innate spell: ${s.name}`,`${s.name} · ${s.ability.toUpperCase()} spellcasting. ${s.usage}${s.needsReview?' Casting rules need DM review.':''}`,s.level)
  return features
}

/** Race grants use character level, and never change a class's slots or ability scores. */
export function applyRaceWorkshopRules(character:Character,rules:PublishedWorkshopRule[],initial:Record<string,WorkshopDraft>={}):Character {
  const c=character
  const published=rules.filter(r=>r.draft.kind==='race')
  const existing=c.homebrew?.bindings.filter(b=>b.rule.kind==='race')??[]
  if(existing.some(b=>b.index===c.meta.raceIndex&&nameKey(b.rule.name)!==nameKey(c.meta.race)&&!published.some(r=>r.id===b.ruleId&&[r.draft.name,...r.previousNames].some(n=>nameKey(n)===nameKey(c.meta.race)))))delete c.meta.raceIndex
  if(!published.length&&!existing.length)return c
  c.homebrew??={bindings:[],choices:{},conflicts:[],acknowledged:[]}
  const state=c.homebrew
  const conflict=(id:string,message:string)=>{if(!state.acknowledged.includes(id)&&!state.conflicts.some(v=>v.id===id))state.conflicts.push({id,message})}
  const matches=published.filter(r=>c.meta.raceIndex?r.index===c.meta.raceIndex||r.previousIndexes.includes(c.meta.raceIndex):[r.draft.name,...r.previousNames].some(n=>nameKey(n)===nameKey(c.meta.race)))
  if(matches.length>1){conflict(`ambiguous:race:${nameKey(c.meta.race)}`,`${c.meta.race}: more than one race definition matches. Choose the race definition in Edit character.`);return c}
  const rule=matches[0]??existing.map(b=>published.find(r=>r.id===b.ruleId)??{id:b.ruleId,revision:b.revision,index:b.index,previousIndexes:[],previousNames:[],draft:b.rule}).find(r=>nameKey(r.draft.name)===nameKey(c.meta.race)&&(!c.meta.raceIndex||r.index===c.meta.raceIndex))
  for(const binding of existing.filter(b=>b.ruleId!==rule?.id)) {
    c.features=c.features.filter(f=>f.ruleId!==binding.ruleId)
    c.resources=c.resources?.flatMap(r=>r.ruleId!==binding.ruleId?[r]:r.used?[{...r,ruleId:undefined,automatic:false}]:[])
    if(binding.rule.race)conflict(`race-detached:${binding.ruleId}`,'Race changed. Review previously granted proficiencies, speed, ability bonuses, and innate spells; current scores and play state were preserved.')
  }
  state.bindings=state.bindings.filter(b=>b.rule.kind!=='race'||b.ruleId===rule?.id)
  if(!rule)return c
  const d=rule.draft,r=d.race
  if(!r)return c
  const before=existing.find(b=>b.ruleId===rule.id),old=before?.rule??initial[rule.id]??d
  const features=raceFeatures(d),previous=raceFeatures(old)
  const gained=features.filter(f=>(f.level??1)<=c.meta.level)
  const revision=`${rule.id}:${rule.revision}`
  for(const feature of old.features.filter(f=>f.choice&&!d.features.some(v=>v.id===f.id&&v.level<=c.meta.level)))if(state.choices[`${rule.id}:${feature.id}`]?.length)conflict(`race-choice-removed:${revision}:${feature.id}`,`${feature.name} is no longer offered at this level. Its previous selections were preserved for review.`)
  for(const f of c.features.filter(f=>f.ruleId===rule.id)) {
    const baseline=previous.find(v=>v.featureId===f.featureId),next=gained.find(v=>v.featureId===f.featureId)
    const unchanged=baseline&&f.name===baseline.name&&f.description===baseline.description
    if(unchanged) { if(next)Object.assign(f,next);else c.features=c.features.filter(v=>v!==f) }
    else if(before?.revision!==rule.revision)conflict(`race-feature-edited:${revision}:${f.featureId}`,`${f.name}: your edited description was preserved. Compare it with the saved race rules.`)
  }
  for(const f of gained) {
    if(c.features.some(v=>v.ruleId===rule.id&&v.featureId===f.featureId))continue
    const imported=c.features.find(v=>!v.ruleId&&nameKey(v.name)===nameKey(f.name)&&(!v.origin||v.origin==='racial'||v.origin==='other'))
    if(imported) {
      const baseline=previous.find(v=>v.featureId===f.featureId)
      if(imported.description===baseline?.description||imported.description===f.description)Object.assign(imported,f,{ruleId:rule.id})
      else {imported.ruleId=rule.id;imported.featureId=f.featureId;imported.origin='racial';imported.level=f.level;conflict(`race-import-edited:${revision}:${f.featureId}`,`${f.name}: the existing character text differs from the race. It was preserved for review.`)}
    } else c.features.push({...f,_id:featureObjectId(rule.id,f.featureId!),ruleId:rule.id})
  }
  for(const feature of d.features.filter(f=>f.choice&&f.level<=c.meta.level)) {
    const key=`${rule.id}:${feature.id}`,selected=state.choices[key]??[],live=c.features.find(f=>f.ruleId===rule.id&&f.featureId===feature.id)
    if(live)live.selectedOptions=[...selected]
    if(selected.length!==feature.choose||selected.some(s=>!feature.options.includes(s)))conflict(`race-choice:${revision}:${feature.id}`,`${feature.name}: choose ${feature.choose} option(s) in Edit character. Previous choices were preserved.`)
    else state.conflicts=state.conflicts.filter(v=>v.id!==`race-choice:${revision}:${feature.id}`)
  }
  const saved=c.resources??[],resources:CharacterResource[]=[]
  for(const resource of d.resources.filter(v=>v.level<=c.meta.level)) {
    const id=`workshop:${rule.id}:${resource.id}`
    const prior=saved.find(v=>v.id===id)??saved.find(v=>!v.ruleId&&nameKey(v.name)===nameKey(resource.name))
    const value=workshopResourceAt(resource,c.meta.level,c.abilities),used=prior?.used??0
    if(used>value.maximum&&!value.unlimited)conflict(`race-spent:${revision}:${resource.id}`,`${resource.name}: spent uses exceed the new maximum. Spent uses were preserved.`)
    resources.push({id,ruleId:rule.id,name:resource.name,max:value.maximum,used,unlimited:value.unlimited,recovery:resource.recovery,notes:resource.notes})
  }
  c.resources=[...saved.flatMap(v=>{
    if(resources.some(n=>n.id===v.id||!v.ruleId&&nameKey(n.name)===nameKey(v.name)))return []
    if(v.ruleId!==rule.id)return [v]
    if(v.used){conflict(`race-resource-removed:${revision}:${v.id}`,`${v.name} was removed from the race; its spent-use record was retained.`);return [{...v,ruleId:undefined,automatic:false}]}
    return []
  }),...resources]
  for(const group of ['armor','weapons','tools'] as const)c.proficiencies[group]=addTraining(c.proficiencies[group],d[group],group)
  c.proficiencies.languages=addTraining(c.proficiencies.languages,r.languages,'languages')
  for(const skill of r.skills)if(!c.skills[skill]||c.skills[skill]==='none')c.skills[skill]='prof'
  if(c.combat.speed===old.race?.speed)c.combat.speed=r.speed
  else if(before&&before.revision!==rule.revision&&r.speed!==old.race?.speed)conflict(`race-speed:${revision}`,'Race speed changed. Your custom movement speed was preserved; review it in Edit character.')
  if(rule.revision>0&&before?.revision!==rule.revision) {
    if(JSON.stringify(old.race?.abilityBonuses)!==JSON.stringify(r.abilityBonuses))conflict(`race-abilities:${revision}`,`Race ability bonuses changed to ${Object.entries(r.abilityBonuses).filter(([,v])=>v).map(([k,v])=>`${k.toUpperCase()} ${v>=0?'+':''}${v}`).join(', ')||'none'}. Existing ability scores were preserved; review them without applying the same bonus twice.`)
    if(JSON.stringify([old.armor,old.weapons,old.tools,old.race?.languages,old.race?.skills])!==JSON.stringify([d.armor,d.weapons,d.tools,r.languages,r.skills]))conflict(`race-training:${revision}`,'Racial training changed. New grants were added; existing proficiencies and player choices were preserved for review.')
  }
  for(const spell of r.spells.filter(s=>s.level<=c.meta.level&&s.needsReview))conflict(`race-spell:${rule.id}:${spell.id}`,`${spell.name}: confirm casting limits in the race Workshop. The imported spell remains visible.`)
  c.meta.race=d.name;c.meta.raceIndex=rule.index
  state.bindings=[...state.bindings.filter(b=>b.ruleId!==rule.id),{ruleId:rule.id,revision:rule.revision,index:rule.index,className:d.name,rule:d}]
  return c
}

export function innateRaceSpells(c:Character) {
  return [...grantedBenefitSpells(c),...(c.homebrew?.bindings??[]).filter(b=>b.rule.kind==='race').flatMap(b=>(b.rule.race?.spells??[]).filter(s=>s.level<=c.meta.level).map(s=>({...s,source:b.rule.name})))]
}
