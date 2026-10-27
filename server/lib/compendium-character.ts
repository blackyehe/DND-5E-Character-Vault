import type { Character, CharacterFeature, EquipmentItem } from '../../shared/character'
import { applyWorkshopRules, ruleName } from '../../shared/workshop-character'
import { workshopFromEntry, type WorkshopDraft, type PublishedWorkshopRule } from '../../shared/homebrew-workshop'
import { cloneEntry, sameEntry, type CompendiumDefinition, type EntryData } from '../../shared/compendium-editing'
import { equipmentFrom, magicEquipmentFrom, type EquipmentDefinition, type MagicItemDefinition } from '../../shared/equipment-definitions'
import { sourceHash } from './orcbrew'
import { characterBenefits, characterBenefitRows, benefitSummary, benefitKey, benefitField } from '../../shared/rule-benefits'

const record=(v:unknown):EntryData=>v&&typeof v==='object'&&!Array.isArray(v)?v as EntryData:{}
const list=(v:unknown):EntryData[]=>Array.isArray(v)?v.map(record):[]
const text=(v:unknown):string=>Array.isArray(v)?v.filter(x=>typeof x==='string').join('\n\n'):typeof v==='string'?v:''
const name=(v:unknown)=>ruleName(String(v??''))
const ids=(e:EntryData)=>[e.index,e.contentKey,...(Array.isArray(e.aliases)?e.aliases:[])].filter(v=>typeof v==='string') as string[]
export function characterUsesDefinition(c:Character,d:CompendiumDefinition,includeReviewed=true):boolean {
  if(includeReviewed&&c.compendiumRules?.some(r=>r.kind===d.kind&&r.index===d.index))return true
  const refs=ids(d.before),named=(v:unknown)=>name(v)===name(d.before.name)
  if(d.kind==='spells')return [...c.spellcasting.known,...c.spellcasting.prepared].some(id=>refs.includes(id))
  if(d.kind==='equipment'||d.kind==='magic-items')return c.equipment.some(e=>refs.includes(e.index??'')||refs.includes(e.magicIndex??'')||d.index===`workshop-item-${e.templateId}`||!e.index&&!e.magicIndex&&named(e.name))
  if(d.kind==='classes')return c.meta.classLevels?.length?c.meta.classLevels.some(e=>e.index?refs.includes(e.index):named(e.name)):c.meta.classIndex?refs.includes(c.meta.classIndex):named(c.meta.klass)
  if(d.kind==='subclasses')return c.meta.classLevels?.length?c.meta.classLevels.some(e=>e.subclassIndex?refs.includes(e.subclassIndex):named(e.subclass)):c.meta.subclassIndex?refs.includes(c.meta.subclassIndex):named(c.meta.subclass)
  if(d.kind==='races')return c.meta.raceIndex?refs.includes(c.meta.raceIndex):named(c.meta.race)
  if(d.kind==='subraces')return named(c.meta.subrace)
  if(d.kind==='backgrounds')return named(c.meta.background)
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
  const next=[...rules],baselines={...initial}
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
function entryFeatures(entry:EntryData,kind:string):CharacterFeature[]{
  const origin=({feats:'feat',backgrounds:'background',subraces:'racial'} as const)[kind as 'feats'|'backgrounds'|'subraces']??'other'
  const traits=list(entry.homebrew_traits??entry.traits??entry.racial_traits)
  const feature=record(entry.feature)
  if(feature.name)traits.push(feature)
  if(!traits.length)return [{name:String(entry.name),description:text(entry.description??entry.desc),origin}]
  return traits.map(t=>({name:String(t.name??t[':name']??''),description:text(t.description??t.desc??t[':description']),origin,level:typeof t.level==='number'?t.level:1}))
}
function itemFrom(entry:EntryData,kind:string):Partial<EquipmentItem>{
  if(entry.workshopItem){const item=cloneEntry(entry.workshopItem as EquipmentItem);if(!item.description)item.description=text(record(entry.itemView).description);return item}
  if(entry.equipment_category)return kind==='magic-items'?magicEquipmentFrom(entry as unknown as MagicItemDefinition):equipmentFrom(entry as unknown as EquipmentDefinition)
  return {name:String(entry.name),description:text(entry.description??entry.desc)}
}
/** Only reviewed definitions participate. Preserve custom text and play-state values. */
export function applyReviewedDefinitions(c:Character):Character{
  for(const d of c.compendiumRules??[]){
    if(['classes','subclasses','races','spells'].includes(d.kind))continue
    if(d.kind==='equipment'||d.kind==='magic-items'){
      const old=itemFrom(d.before,d.kind),next=itemFrom(d.entry,d.kind)
      c.equipment=c.equipment.map(item=>{
        if(!ids(d.before).includes(item.index??'')&&!ids(d.before).includes(item.magicIndex??'')&&d.index!==`workshop-item-${item.templateId}`&&!(name(item.name)===name(d.before.name)&&!item.index&&!item.magicIndex))return item
        const result={...item}
        for(const key of ['name','weight','category','tags','rarity','value','attunementRequirement','description','armor','weapon','magicBonus','kind','magical','requiresAttunement','effects'] as const){
          if(!sameEntry(old[key],next[key])&&(sameEntry(item[key],old[key])||sameEntry(item[key],next[key])||item[key]===undefined))Object.assign(result,{[key]:next[key]})
        }
        return result
      })
      continue
    }
    const before=entryFeatures(d.before,d.kind),after=entryFeatures(d.entry,d.kind)
    c.features=c.features.map(f=>{
      const i=before.findIndex(old=>name(old.name)===name(f.name)&&(old.origin==='other'||!f.origin||f.origin==='other'||f.origin===old.origin))
      if(i<0)return f
      const old=before[i]!,next=after.find(v=>name(v.name)===name(old.name))??(before.length===after.length?after[i]:undefined)
      if(before.filter(v=>name(v.name)===name(old.name)).length>1)return f
      if(!next||f.description&&f.description!==old.description&&f.description!==next.description)return f
      return {...f,name:next.name,description:next.description,level:next.level??f.level,origin:next.origin==='other'?f.origin:next.origin}
    })
    if(d.kind==='backgrounds'&&name(c.meta.background)===name(d.before.name))c.meta.background=String(d.entry.name)
    if(d.kind==='subraces'&&name(c.meta.subrace)===name(d.before.name))c.meta.subrace=String(d.entry.name)
  }
  return c
}
export function reviewedCharacter(c:Character,rules:PublishedWorkshopRule[],initial:Record<string,WorkshopDraft>){
  const reviewed=reviewedWorkshopRules(c,rules,initial)
  return applyReviewedDefinitions(applyWorkshopRules(c,reviewed.rules,reviewed.initial))
}
export function characterReviewChanges(before:Character,after:Character){
  const benefits=(c:Character)=>({effective:characterBenefits(c),sources:characterBenefitRows(c).map(r=>({source:r.source,benefit:benefitSummary(r.row),active:r.active,level:r.level}))});const a=benefits(before),b=benefits(after)
  return [...(sameEntry(a,b)?[]:[{field:'benefits and defenses',before:a,after:b}]),...['meta','features','equipment','combat','abilities','saves','skills','resources','spellcasting','proficiencies'].flatMap(field=>{
    const a=before[field as keyof Character],b=after[field as keyof Character]
    return sameEntry(a,b)?[]:[{field,before:a,after:b}]
  })]
}
