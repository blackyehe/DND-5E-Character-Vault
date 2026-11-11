import type { Attack, Character, CharacterFeature, EquipmentItem } from '../../shared/character'
import { applyWorkshopRules, ruleName } from '../../shared/workshop-character'
import { workshopFromEntry, type WorkshopDraft, type PublishedWorkshopRule } from '../../shared/homebrew-workshop'
import { cloneEntry, sameEntry, type CompendiumDefinition, type EntryData } from '../../shared/compendium-editing'
import { equipmentFrom, magicEquipmentFrom, type EquipmentDefinition, type MagicItemDefinition } from '../../shared/equipment-definitions'
import { sourceHash } from './orcbrew'
import {optionHasId,optionLabelMatches} from '../../shared/option-reference'
import {choiceDescription,type ChoiceGroup} from '../../shared/choice-groups'
import {isFeatureOptionKind,isOptionKind} from '../../shared/option-kinds'
import { characterBenefits, characterBenefitRows, benefitSummary, benefitKey, benefitField, entryBenefits, benefitProblems, benefitKnownSpellIds } from '../../shared/rule-benefits'
import {ITEM_DEFINITION_FIELDS,itemDefinitionSnapshot} from '../../shared/item-definition'
import {sameDefinition} from './definition-editions'
import {reconcileLinkedTrackers} from '../../shared/option-trackers'
import {resourcesFor} from '../../shared/character-resources'

const record=(v:unknown):EntryData=>v&&typeof v==='object'&&!Array.isArray(v)?v as EntryData:{}
const list=(v:unknown):EntryData[]=>Array.isArray(v)?v.map(record):[]
const text=(v:unknown):string=>Array.isArray(v)?v.filter(x=>typeof x==='string').join('\n\n'):typeof v==='string'?v:''
const name=(v:unknown)=>ruleName(String(v??''))
const ids=(e:EntryData)=>[e.index,e.contentKey,...(Array.isArray(e.aliases)?e.aliases:[])].filter(v=>typeof v==='string') as string[]
export function characterUsesDefinition(c:Character,d:CompendiumDefinition,includeReviewed=true):boolean {
  const approved=c.compendiumRules?.filter(r=>sameDefinition(r,d.kind,d.index,d.before))??[]
  if(includeReviewed&&approved.length)return true
  const refs=[...new Set([...ids(d.before),...approved.flatMap(r=>[r.index,...ids(r.entry),...ids(r.before)])])],names=[d.before.name,...approved.flatMap(r=>[r.entry.name,r.before.name])].map(name),named=(v:unknown)=>names.includes(name(v))
  const option={...d.before,index:d.index,name:String(d.before.name),aliases:refs}
  if(d.kind==='spells')return benefitKnownSpellIds(c).some(id=>refs.includes(id))
  if(d.kind==='equipment'||d.kind==='magic-items')return c.equipment.some(e=>refs.includes(e.index??'')||refs.includes(e.magicIndex??'')||d.index===`workshop-item-${e.templateId}`||!e.index&&!e.magicIndex&&named(e.name))
  if(d.kind==='classes')return c.meta.classLevels?.length?c.meta.classLevels.some(e=>e.index?refs.includes(e.index):named(e.name)):c.meta.classIndex?refs.includes(c.meta.classIndex):named(c.meta.klass)
  if(d.kind==='subclasses')return c.meta.classLevels?.length?c.meta.classLevels.some(e=>e.subclassIndex?refs.includes(e.subclassIndex):named(e.subclass)):c.meta.subclassIndex?refs.includes(c.meta.subclassIndex):named(c.meta.subclass)
  if(d.kind==='races')return c.meta.raceIndex?refs.includes(c.meta.raceIndex):named(c.meta.race)
  if(d.kind==='subraces')return c.meta.subraceIndex?refs.includes(c.meta.subraceIndex):named(c.meta.subrace)
  if(d.kind==='backgrounds')return c.meta.backgroundIndex?refs.includes(c.meta.backgroundIndex):optionLabelMatches(option,c.meta.background)||named(c.meta.background)
  if(isFeatureOptionKind(d.kind))return c.features.some(f=>f.definition?f.definition.kind===d.kind&&optionHasId(option,f.definition.index):optionLabelMatches(option,f.name)||named(f.name)||d.kind==='feats'&&/^feats?$/i.test(f.name.trim())&&f.description.split(/[,;\n]+/).some(named))
  if(d.kind==='languages')return c.proficiencies.languages.some(named)
  if(d.kind==='monsters')return false
  return c.features.some(f=>named(f.name)||/^feats?$/i.test(f.name.trim())&&f.description.split(/[,;\n]+/).some(named))
}
function draftFor(entry:EntryData,kind:WorkshopDraft['kind'],baseline?:WorkshopDraft):WorkshopDraft {
  let input=entry
  if(Array.isArray(entry.benefits))input={...entry,details:{...record(entry.details),':level-modifiers':entry.benefits.map(row=>({':type':':'+benefitKey(benefitField(row,'type')),':value':typeof benefitField(row,'value')==='string'?':'+benefitKey(benefitField(row,'value')):benefitField(row,'value'),':level':benefitField(row,'level')??1}))}}
  const d=workshopFromEntry(input,kind),native=record(entry.workshop)
  if(native.version===1)Object.assign(d,cloneEntry(native))
  // These defenses are now described and level-gated by the shared benefit panel.
  if(Array.isArray(entry.benefits)&&d.race){d.race.resistances=[];d.race.immunities=[]}
  if(!baseline){
    const hash=sourceHash(`${kind}:${entry.index}`).slice(0,32)
    if(!native.id)d.id=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`
    d.features.forEach((f,i)=>{if(!native.id)f.id=`${d.id}:feature:${i}`})
  }else if(!native.id){d.id=baseline.id;d.features.forEach((f,i)=>{f.id=baseline.features[i]?.id??`${d.id}:feature:${i}`})}
  if(!native.id){d.updatedAt='1970-01-01T00:00:00.000Z';d.resources.forEach((r,i)=>{r.id=baseline?.resources[i]?.id??`${d.id}:resource:${i}`});d.race?.spells.forEach((s,i)=>{s.id=baseline?.race?.spells[i]?.id??`${d.id}:spell:${i}`})}
  // Native Workshop rules are authored together; imported normalised controls take precedence otherwise.
  if(!native.id){
    d.name=String(entry.name??d.name);d.description=text(entry.description??entry.desc)||d.description
    if(typeof entry.hit_die==='number')d.hitDie=entry.hit_die
    if(kind==='race'&&d.race&&typeof entry.speed==='number')d.race.speed=entry.speed
  }
  return d
}
export function reviewedWorkshopRules(c:Character,rules:PublishedWorkshopRule[],initial:Record<string,WorkshopDraft>){
  const next=rules.map(rule=>{
    const binding=c.homebrew?.bindings.find(b=>b.ruleId===rule.id)
    if(!binding){
      const indexes=[c.meta.classIndex,c.meta.subclassIndex,c.meta.raceIndex,...(c.meta.classLevels??[]).flatMap(row=>[row.index,row.subclassIndex])]
      const baseline=initial[rule.id]
      return baseline&&!indexes.includes(rule.index)?{...rule,revision:0,draft:baseline,index:rule.previousIndexes[0]??rule.index,previousIndexes:[rule.index,...rule.previousIndexes]}:rule
    }
    return {...rule,index:binding.index,revision:binding.revision,draft:binding.rule,previousIndexes:[...new Set([rule.index,...rule.previousIndexes])]}
  }),baselines={...initial}
  for(const def of c.compendiumRules??[]){
    const kind=({classes:'class',subclasses:'subclass',races:'race'} as const)[def.kind as 'classes'|'subclasses'|'races']
    if(!kind)continue
    const binding=c.homebrew?.bindings.find(b=>b.index===def.index||b.rule.imported?.index===def.index)
    const original=next.find(r=>r.index===def.index||r.previousIndexes.includes(def.index))??(binding?{id:binding.ruleId,index:binding.index,revision:binding.revision,previousIndexes:[],previousNames:[],draft:binding.rule}:undefined)
    const before=draftFor(def.before,kind,original?.draft),after=draftFor(def.entry,kind,before)
    if(original){before.id=original.id;after.id=original.id;const position=next.indexOf(original);if(position>=0)next.splice(position,1)}
    // Approved snapshots stay fixed until the owner reviews another revision.
    const rule:PublishedWorkshopRule={id:after.id,index:def.index,revision:1000000+def.revision,previousIndexes:original?.previousIndexes??[],previousNames:[String(def.before.name),...(original?.previousNames??[])],parentClassName:original?.parentClassName,draft:after}
    next.push(rule);baselines[rule.id]=before
  }
  return {rules:next,initial:baselines}
}
function entryFeatures(entry:EntryData,kind:string,index:string):CharacterFeature[]{
  const origin=({feats:'feat',backgrounds:'background',subraces:'racial'} as const)[kind as 'feats'|'backgrounds'|'subraces']??'other'
  const traits=list(entry.homebrew_traits??entry.traits??entry.racial_traits)
  const feature=record(entry.feature)
  if(feature.name)traits.push(feature)
  const source=(key:string)=>isOptionKind(kind)?{compendiumSource:{kind,index,key}}:{}
  if(!traits.length){const description=text(entry.description??entry.desc);return !description&&(kind==='backgrounds'||kind==='subraces')?[]:[{name:String(entry.name),description,origin,...source('entry')}]}
  const features=traits.map(t=>({name:String(t.name??t[':name']??''),description:text(t.description??t.desc??t[':description']),origin,level:typeof t.level==='number'?t.level:1,...source(typeof (t.id??t.index)==='string'?`id:${t.id??t.index}`:`name:${name(t.name??t[':name'])}`)}))
  // Imported backgrounds may expose the same grant in both traits and feature.
  return features.filter((f,i)=>features.findIndex(other=>name(other.name)===name(f.name)&&other.description===f.description&&other.level===f.level)===i)
}
function reviewConflict(c:Character,d:CompendiumDefinition,key:string,message:string){
  c.homebrew??={bindings:[],choices:{},conflicts:[],acknowledged:[]}
  const id=`compendium:${d.kind}:${d.index}:${d.revision}:${key}`
  if(!c.homebrew.acknowledged.includes(id)&&!c.homebrew.conflicts.some(row=>row.id===id))c.homebrew.conflicts.push({id,message})
}
function reconcileEntryFeatures(c:Character,d:CompendiumDefinition){
  if(!isOptionKind(d.kind)||d.kind==='languages'||!characterUsesDefinition(c,d,false))return
  const before=entryFeatures(d.before,d.kind,d.index),after=entryFeatures(d.entry,d.kind,d.index),refs=new Set([d.index,...ids(d.before),...ids(d.entry)])
  const owns=(f:CharacterFeature)=>f.compendiumSource?.kind===d.kind&&refs.has(f.compendiumSource.index)
  const selected=(f:CharacterFeature)=>f.definition?.kind===d.kind&&refs.has(f.definition.index)
  const compatible=(a:CharacterFeature,b:CharacterFeature)=>!a.origin||a.origin==='other'||b.origin==='other'||a.origin===b.origin
  const key=(f:CharacterFeature)=>f.compendiumSource?.key
  const selectedText=(entry:EntryData,f:CharacterFeature,description:string)=>{const group=(entry.optionBuilder as {choiceGroup?:ChoiceGroup}|undefined)?.choiceGroup;return d.kind==='selections'&&group?[description,choiceDescription(group,f.definition?.choiceIds??[])].filter(Boolean).join('\n\n'):description}
  const claimed=new Set<string>()
  c.features=c.features.flatMap(f=>{
    // The acquisition row remains the option itself. Traits are separate child
    // rows, so replacing the last trait cannot erase or repeatedly rewrite it.
    if(selected(f)){
      const root=after.find(row=>key(row)==='entry'),source=root?.compendiumSource
      if(source)claimed.add(source.key)
      const description=selectedText(d.entry,f,text(d.entry.description??d.entry.desc))
      const previous=[text(d.before.description??d.before.desc),...before.map(row=>row.description)].map(value=>selectedText(d.before,f,value))
      if(f.description&&f.description!==description&&!previous.includes(f.description)){reviewConflict(c,d,'custom:entry',`${f.name}: your edited feature was preserved. Compare it with the saved ${d.kind} rules.`);return [{...f,compendiumSource:source}]}
      return [{...f,name:String(d.entry.name),description,compendiumSource:source}]
    }
    const matches=owns(f)?before.filter(old=>key(old)===key(f)):before.filter(old=>compatible(f,old)&&name(old.name)===name(f.name))
    const old=matches.length===1?matches[0]:undefined
    const next=after.find(row=>key(row)===(old?key(old):owns(f)?key(f):undefined))
    if(!old&&!owns(f))return [f]
    // Legacy name links are accepted only once and never across another source.
    const ambiguous=!owns(f)&&(!selected(f)&&(!!f.ruleId||!!f.definition||!!f.compendiumSource)||matches.length!==1||c.features.filter(v=>!v.compendiumSource&&name(v.name)===name(f.name)&&compatible(v,f)).length>1||(c.compendiumRules??[]).some(other=>other!==d&&isOptionKind(other.kind)&&other.kind!=='languages'&&characterUsesDefinition(c,other,false)&&[other.before,other.entry].flatMap(entry=>entryFeatures(entry,other.kind,other.index)).some(row=>name(row.name)===name(f.name)&&compatible(row,f))))
    if(ambiguous){reviewConflict(c,d,`ambiguous:${name(f.name)}`,`${f.name}: more than one saved feature or source could match. The existing feature was kept; review it manually.`);return [f]}
    const source=next?.compendiumSource??old?.compendiumSource??f.compendiumSource
    if(source)claimed.add(source.key)
    const unchanged=!f.description||!!old&&(f.description===old.description||f.description===selectedText(d.before,f,old.description))||!!next&&f.description===selectedText(d.entry,f,next.description)
    if(!unchanged||old&&f.name!==old.name&&f.name!==next?.name&&!selected(f)){reviewConflict(c,d,`custom:${source?.key}`,`${f.name}: your edited feature was preserved. Compare it with the saved ${d.kind} rules.`);return [{...f,compendiumSource:source}]}
    if(!next)return []
    return [{...f,name:next.name,description:selectedText(d.entry,f,next.description),origin:next.origin==='other'?f.origin:next.origin,level:!f.definition&&(f.level===undefined||f.level===old?.level)?next.level:f.level,compendiumSource:source}]
  })
  for(const feature of after){
    const source=feature.compendiumSource!
    if(claimed.has(source.key)||c.features.some(f=>owns(f)&&key(f)===source.key))continue
    if(after.filter(f=>key(f)===source.key).length>1||c.features.some(f=>name(f.name)===name(feature.name)&&compatible(f,feature))){reviewConflict(c,d,`added:${source.key}`,`${feature.name}: an existing or ambiguous feature was kept. Review the new source trait manually.`);continue}
    const acquisitionLevel=c.features.find(f=>selected(f))?.level??1
    c.features.push({...feature,level:Math.max(feature.level??1,acquisitionLevel)});claimed.add(source.key)
  }
}
function itemFrom(entry:EntryData,kind:string):Partial<EquipmentItem>{
  if(entry.workshopItem){const item=cloneEntry(entry.workshopItem as EquipmentItem);if(!item.description)item.description=text(record(entry.itemView).description);return item}
  if(entry.equipment_category)return kind==='magic-items'?magicEquipmentFrom(entry as unknown as MagicItemDefinition):equipmentFrom(entry as unknown as EquipmentDefinition)
  return {name:String(entry.name),description:text(entry.description??entry.desc)}
}
function weaponAttack(c:Character,item:EquipmentItem):Partial<Attack>{
  const weapon=item.weapon
  return weapon?{name:item.name,ability:weapon.ranged||weapon.finesse&&c.abilities.dex>c.abilities.str?'dex':'str',range:weapon.range,damageDice:weapon.dice,damageType:weapon.damageType,magicBonus:item.magicBonus??0}:{}
}
/** Only reviewed definitions participate. Preserve custom text and play-state values. */
export function applyReviewedDefinitions(c:Character):Character{
  for(const d of c.compendiumRules??[]){
    if(['classes','subclasses','races','spells'].includes(d.kind))continue
    if(d.kind==='equipment'||d.kind==='magic-items'){
      const old=itemFrom(d.before,d.kind),next=itemFrom(d.entry,d.kind)
      c.equipment=c.equipment.map(item=>{
        if(!ids(d.before).includes(item.index??'')&&!ids(d.before).includes(item.magicIndex??'')&&d.index!==`workshop-item-${item.templateId}`&&!(name(item.name)===name(d.before.name)&&!item.index&&!item.magicIndex))return item
        // A newly acquired copy can already use a newer edition than the
        // character's previously approved copies. Never downgrade that copy.
        if(item.templateDefinitionRevision!==undefined&&item.templateDefinitionRevision>d.revision)return item
        const result={...item}
        const baseline=item.templateBaseline??old
        for(const key of ITEM_DEFINITION_FIELDS.filter(key=>key!=='benefits'&&key!=='trackers')){
          if(!sameEntry(baseline[key],next[key])&&(sameEntry(item[key],baseline[key])||sameEntry(item[key],next[key])||item[key]===undefined))Object.assign(result,{[key]:next[key]})
        }
        // Keep the inventory's visible snapshot in sync with the approved edition.
        const benefits=entryBenefits(d.entry).filter(row=>benefitProblems([row]).length===0)
        if(benefits.length||Array.isArray(d.entry.benefits)||item.benefits)result.benefits=cloneEntry(benefits)
        if(Array.isArray(next.trackers)||Array.isArray(old.trackers)||item.trackers)result.trackers=cloneEntry(next.trackers??[])
        // Legacy attacks have only a name link. Update an unambiguous copy's
        // source-derived fields, retaining independently customised attack values.
        const attackNames=new Set([name(item.name),...(name(item.name)===name(next.name)?[name(old.name)]:[])])
        const linkedAttacks=c.attacks.filter(attack=>attackNames.has(name(attack.name)))
        const uniqueCopy=c.equipment.filter(e=>attackNames.has(name(e.name))).length===1
        if(item.weapon&&result.weapon&&uniqueCopy){
          const attackBefore=weaponAttack(c,item),originalAttack=weaponAttack(c,{...item,...old}),attackAfter=weaponAttack(c,result)
          c.attacks=c.attacks.map(attack=>{
            if(!attackNames.has(name(attack.name)))return attack
            const updated={...attack}
            for(const key of ['name','ability','range','damageDice','damageType','magicBonus'] as const)if(sameEntry(attack[key],attackBefore[key])||sameEntry(attack[key],originalAttack[key]))Object.assign(updated,{[key]:attackAfter[key]})
            return updated
          })
        }
        if(linkedAttacks.length&&(!uniqueCopy||item.weapon&&!result.weapon))reviewConflict(c,d,`weapon:${name(item.name)}`,`${item.name}: saved attacks were kept because their inventory link is ambiguous or the source is no longer a weapon. Review those attacks manually.`)
        if(item.templateId){result.templateDefinitionRevision=d.revision;result.templateBaseline=itemDefinitionSnapshot({...next,...(result.benefits?{benefits:result.benefits}:{})});if(typeof next.templateRevision==='number')result.templateRevision=next.templateRevision}
        return result
      })
      continue
    }
    reconcileEntryFeatures(c,d)
    if(d.kind==='languages')c.proficiencies.languages=c.proficiencies.languages.map(v=>name(v)===name(d.before.name)?String(d.entry.name):v)
    if(d.kind==='backgrounds'&&(c.meta.backgroundIndex?optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},c.meta.backgroundIndex):optionLabelMatches({...d.before,index:d.index,name:String(d.before.name)},c.meta.background)))c.meta.background=String(d.entry.name)
    if(d.kind==='subraces'&&(c.meta.subraceIndex?optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},c.meta.subraceIndex):name(c.meta.subrace)===name(d.before.name)))c.meta.subrace=String(d.entry.name)
  }
  return c
}
export function reviewedCharacter(c:Character,rules:PublishedWorkshopRule[],initial:Record<string,WorkshopDraft>){
  c=reconcileLinkedTrackers(c)
  const reviewed=reviewedWorkshopRules(c,rules,initial)
  return reconcileLinkedTrackers(applyReviewedDefinitions(applyWorkshopRules(c,reviewed.rules,reviewed.initial)))
}
export function characterReviewChanges(before:Character,after:Character){
  const benefits=(c:Character)=>({effective:characterBenefits(c),sources:characterBenefitRows(c).map(r=>({source:r.source,benefit:benefitSummary(r.row),active:r.active,level:r.level}))});const a=benefits(before),b=benefits(after)
  return [...(sameEntry(a,b)?[]:[{field:'benefits and defenses',before:a,after:b}]),...['meta','features','equipment','attacks','combat','abilities','saves','skills','resources','spellcasting','proficiencies'].flatMap(field=>{
    const value=(c:Character)=>field==='resources'?resourcesFor(c):field==='features'?c.features.map(({compendiumSource,...feature})=>feature):c[field as keyof Character]
    const a=value(before),b=value(after)
    return sameEntry(a,b)?[]:[{field,before:a,after:b}]
  })]
}
