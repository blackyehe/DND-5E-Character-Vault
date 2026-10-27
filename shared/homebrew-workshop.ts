import { ABILITY_KEYS, abilityMod, profBonus, type AbilityKey } from './calc'
import { slotMaximums } from './character-progression'
import { classSpellDefaults, isRevenantShadow } from './class-rules'
import type { SlotProgression } from './character'

export const WORKSHOP_STEPS = [
  {key:'identity',name:'Identity',hint:'Name, source & parent class',icon:'book'},
  {key:'foundation',name:'Core training',hint:'Hit die & proficiencies',icon:'shield'},
  {key:'progression',name:'Level progression',hint:'Advancements & attacks',icon:'dice'},
  {key:'magic',name:'Spellcasting',hint:'Slots, choices & spell list',icon:'wand'},
  {key:'resources',name:'Resource trackers',hint:'Pools, formulas & recovery',icon:'star'},
  {key:'features',name:'Features & choices',hint:'Rules gained at each level',icon:'swords'},
  {key:'review',name:'Review',hint:'Check the complete creation',icon:'check'},
] as const
export type WorkshopStep = typeof WORKSHOP_STEPS[number]['key']
export interface WorkshopSchedule { level:number; total:number;originalLevel?:number }
export interface WorkshopResource {
  id:string; name:string; level:number; basis:'fixed'|'level'|'ability'|'proficiency'; ability:AbilityKey;
  multiplier:number; base:number; minimum:number; recovery:'short'|'long'|'manual'; unlimitedAt:number|null; notes:string
}
export interface WorkshopFeature { id:string; name:string; level:number; description:string; choice:boolean; choose:number; options:string[]; originalIndex?:number; originalSelection?:number }
export interface WorkshopRace {
  speed:number; size:string; darkvision:number; languages:string[]; skills:string[];
  abilityBonuses:Record<AbilityKey,number>; resistances:string[]; immunities:string[];
  naturalArmor:string;
  spells:{id:string;index:string;name:string;level:number;ability:AbilityKey;usage:string;needsReview:boolean}[]
}
export const workshopSection=(kind:WorkshopDraft['kind'])=>kind==='race'?'races':kind==='class'?'classes':'subclasses'
export function newWorkshopRace():WorkshopRace { return {speed:30,size:'medium',darkvision:0,languages:[],skills:[],abilityBonuses:{str:0,dex:0,con:0,int:0,wis:0,cha:0},resistances:[],immunities:[],naturalArmor:'',spells:[]} }
export interface WorkshopDraft {
  localId?:string
  version:1; id:string; kind:'class'|'subclass'|'race'; name:string; source:string; description:string;
  race?:WorkshopRace;
  parentClass:string; hitDie:number; savingThrows:AbilityKey[]; armor:string[]; weapons:string[]; tools:string[];
  skillCount:number; skillOptions:string[]; expertiseCount:number; subclassLevel:number; subclassTitle:string;
  asiLevels:number[]; attacks:WorkshopSchedule[];
  magic:{ enabled:boolean; ability:AbilityKey; progression:SlotProgression; startsAt:number;
    learning:'known'|'prepared'|'book'; cantrips:WorkshopSchedule[]; spells:WorkshopSchedule[];
    preparedLevel:'full'|'half'|'none'; preparedBase:number; spellList:string[] };
  resources:WorkshopResource[]; features:WorkshopFeature[];
  imported?:{index:string; contentKey:string; sources:string[]; raw:Record<string,unknown>};
  updatedAt:string
  published?:{revision:number;index:string;packId:string;packHash:string}
}
export interface PublishedWorkshopRule { id:string; revision:number; index:string; previousIndexes:string[]; previousNames:string[]; parentClassName?:string; draft:WorkshopDraft }
export const plainObject = (value:unknown):Record<string,unknown> => value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[]
const local=(value:unknown)=>String(value??'').replace(/^:/,'').replace(/^.*\//,'')
const title=(s:string)=>s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
const enabled=(value:unknown)=>Object.entries(plainObject(value)).filter(([,v])=>v===true).map(([key])=>local(key))
const skillKey=(value:string)=>value.replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase())
export function newWorkshopDraft(kind:WorkshopDraft['kind']='class'):WorkshopDraft {
  return {version:1,id:crypto.randomUUID(),kind,name:'',source:'My Homebrew',description:'',parentClass:'',hitDie:8,savingThrows:[],armor:[],weapons:[],tools:[],skillCount:2,skillOptions:[],expertiseCount:0,
    subclassLevel:3,subclassTitle:'Subclass',asiLevels:kind==='class'?[4,8,12,16,19]:[],attacks:kind==='class'?[{level:1,total:1}]:[],
    magic:{enabled:false,ability:'int',progression:'full',startsAt:1,learning:'known',cantrips:[],spells:[],preparedLevel:'full',preparedBase:0,spellList:[]},resources:[],features:[],...(kind==='race'?{race:newWorkshopRace()}:{}),updatedAt:new Date().toISOString()}
}
export function newWorkshopResource():WorkshopResource {
  return {id:crypto.randomUUID(),name:'',level:1,basis:'level',ability:'con',multiplier:1,base:0,minimum:0,recovery:'long',unlimitedAt:null,notes:''}
}
export function newWorkshopFeature(choice=false):WorkshopFeature {
  return {id:crypto.randomUUID(),name:'',level:1,description:'',choice,choose:1,options:[]}
}
/** Add provenance to drafts saved by the original editor preview. */
export function restoreWorkshopDraft(value:WorkshopDraft):WorkshopDraft {
  const draft=JSON.parse(JSON.stringify(value)) as WorkshopDraft,raw=plainObject(draft.imported?.raw)
  const traits=list(raw[':traits']).map(plainObject),selections=list(raw[':level-selections']).map(plainObject)
  const usedTraits=new Set(draft.features.flatMap(f=>f.originalIndex===undefined?[]:[f.originalIndex]))
  const usedSelections=new Set(draft.features.flatMap(f=>f.originalSelection===undefined?[]:[f.originalSelection]))
  for(const f of draft.features){
    if(f.choice&&f.originalSelection===undefined&&f.originalIndex===undefined){const matches=selections.map((v,i)=>({v,i})).filter(({v,i})=>!usedSelections.has(i)&&title(local(v[':type'])).toLowerCase()===f.name.toLowerCase()&&Number(v[':level']??1)===f.level);if(matches.length===1){f.originalSelection=matches[0]!.i;usedSelections.add(f.originalSelection)}}
    else if(!f.choice&&f.originalIndex===undefined){const matches=traits.map((v,i)=>({v,i})).filter(({v,i})=>!usedTraits.has(i)&&(v[':name']===f.name&&Number(v[':level']??1)===f.level||f.description&&v[':description']===f.description));if(matches.length===1){f.originalIndex=matches[0]!.i;usedTraits.add(f.originalIndex)}}
  }
  for(const row of draft.attacks)if(row.originalLevel===undefined){const matches=list(raw[':level-modifiers']).map(plainObject).filter(m=>m[':type']===':num-attacks'&&(Number(m[':level']??1)===row.level||Number(m[':value'])===row.total));if(matches.length===1)row.originalLevel=Number(matches[0]![':level']??1)}
  return draft
}
function importedSchedule(value:unknown):WorkshopSchedule[] {
  let total=0
  return Object.entries(plainObject(value)).filter(([level,n])=>/^\d+$/.test(level)&&typeof n==='number').sort((a,b)=>Number(a[0])-Number(b[0])).map(([level,n])=>({level:Number(level),total:total+=Number(n)}))
}
export function workshopFromEntry(entry:Record<string,unknown>,kind:WorkshopDraft['kind']):WorkshopDraft {
  const native=plainObject(plainObject(entry.details)[':codex/workshop'])
  if(native.version===1&&native.id&&native.magic&&Array.isArray(native.features))return JSON.parse(JSON.stringify({...native,imported:{index:entry.index,contentKey:entry.contentKey,sources:entry.sourcePacks??[],raw:entry.details}})) as WorkshopDraft
  const draft=newWorkshopDraft(kind),raw=plainObject(entry.details),profs=plainObject(raw[':profs']),casting=plainObject(raw[':spellcasting'])
  draft.name=String(entry.name??'');draft.source=String(entry.sourcePack??entry.source??'My Homebrew');draft.description=String(raw[':help']??raw[':description']??'')
  draft.parentClass=local(raw[':class']??entry.class);draft.hitDie=Number(entry.hit_die??8)
  draft.savingThrows=enabled(profs[':save']).filter((key):key is AbilityKey=>ABILITY_KEYS.includes(key as AbilityKey))
  const modifiers=list(raw[':level-modifiers']).map(plainObject)
  const initialProfs=(type:string)=>modifiers.filter(m=>m[':type']===`:${type}`&&Number(m[':level']??1)<=1).map(m=>local(m[':value']))
  const props=plainObject(raw[':props']);draft.armor=[...new Set([...enabled(props[':armor-prof']),...initialProfs('armor-prof')])].map(v=>/^(light|medium|heavy)$/.test(v)?`${title(v)} armor`:title(v));draft.weapons=[...new Set([...enabled(props[':weapon-prof']),...initialProfs('weapon-prof')])].map(v=>/^(simple|martial)$/.test(v)?`All ${v} weapons`:title(v));draft.tools=[...new Set([...enabled(profs[':tool']),...initialProfs('tool-prof')])].map(title)
  const skills=plainObject(profs[':skill-options']);draft.skillCount=Number(skills[':choose']??0);draft.skillOptions=enabled(skills[':options']).map(skillKey);draft.expertiseCount=Number(plainObject(profs[':skill-expertise-options'])[':choose']??0)
  draft.subclassLevel=Number(raw[':subclass-level']??3);draft.subclassTitle=String(raw[':subclass-title']??'Subclass')
  if(Array.isArray(raw[':ability-increase-levels']))draft.asiLevels=raw[':ability-increase-levels'].map(Number)
  draft.attacks=[...(kind==='class'?[{level:1,total:1}]:[]),...modifiers.filter(m=>m[':type']===':num-attacks').map(m=>({level:Number(m[':level']??1),originalLevel:Number(m[':level']??1),total:Number(m[':value'])}))]
  const defaults=classSpellDefaults(draft.name),factor=Number(casting[':level-factor']??1)
  draft.magic={...draft.magic,enabled:!!Object.keys(casting).length,ability:(ABILITY_KEYS.includes(local(casting[':ability']) as AbilityKey)?local(casting[':ability']):defaults?.ability??'int') as AbilityKey,
    progression:defaults?.progression??(factor===2?'half':factor===3?'third':'full'),startsAt:Number(casting[':spellcasting-level']??(factor===2?2:factor===3?3:1)),
    cantrips:importedSchedule(casting[':cantrips-known']),spells:importedSchedule(casting[':spells-known']),learning:casting[':known-mode']===':schedule'?'known':'prepared',
    spellList:[...new Set(Object.values(plainObject(casting[':spell-list'])).flatMap(list).map(local))]}
  const traits=list(entry.homebrew_traits??entry.traits??raw[':traits'])
  draft.features=traits.map((value,originalIndex)=>{const t=plainObject(value);return {...newWorkshopFeature(),originalIndex,name:String(t.name??t[':name']??''),description:String(t.description??t[':description']??''),level:Number(t.level??t[':level']??1)}})
  draft.features.push(...list(raw[':level-selections']).map((value,originalSelection)=>{const choice=plainObject(value);return {...newWorkshopFeature(true),originalSelection,name:title(local(choice[':type'])),level:Number(choice[':level']??1),choose:Number(choice[':num']??1)}}))
  if(isRevenantShadow(draft.name))draft.resources=[{...newWorkshopResource(),name:'Shadow points'}, {...newWorkshopResource(),name:'Mantle of Darkness',level:3,basis:'ability',minimum:1,notes:'CON modifier, minimum 1 use.'}]
  if(kind==='subclass'&&/riftborne sycoph?ant/i.test(draft.name))draft.resources=[{...newWorkshopResource(),name:'Rift points',level:2,notes:'d8 at level 2, d12 at level 6, d20 at level 12.'},{...newWorkshopResource(),name:'Riftborne bonus slot',level:6,basis:'fixed',base:1,multiplier:0,notes:'One bonus slot at your highest ordinary spell level.'}]
  draft.imported={index:String(entry.index),contentKey:String(entry.contentKey??''),sources:list(entry.sourcePacks).map(String),raw}
  if(kind==='race') {
    // Catalog indices contain a content hash. Stable identifiers let unchanged imported
    // races reconcile on every read before their first Workshop publication.
    const hash=String(entry.index).match(/[a-f0-9]{32}$/)?.[0]
    if(hash)draft.id=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`
    const stable=(n:number)=>`${draft.id.slice(0,24)}${(BigInt(`0x${draft.id.slice(24)}`)+BigInt(n+1)).toString(16).padStart(12,'0').slice(-12)}`
    draft.features.forEach((f,i)=>{f.id=stable(i)})
    draft.race={...newWorkshopRace(),speed:Number(raw[':speed']??entry.speed??30),size:local(raw[':size']??entry.size??'medium'),darkvision:Number(raw[':darkvision']??0),
      languages:list(raw[':languages']).map(String),skills:enabled(props[':skill-prof']).map(skillKey),
      abilityBonuses:Object.fromEntries(ABILITY_KEYS.map(key=>[key,Number(plainObject(raw[':abilities'])[`:orcpub.dnd.e5.character/${key}`]??0)])) as Record<AbilityKey,number>,
      resistances:enabled(props[':damage-resistance']),immunities:enabled(props[':damage-immunity']),
      naturalArmor:props[':lizardfolk-ac']===true?'Imported Lizardfolk natural-armour rule — confirm the formula in this editor.':'',
      spells:list(raw[':spells']).map((value,i)=>{const v=plainObject(plainObject(value)[':value']);return {id:stable(2000+i),index:local(v[':key']),name:title(local(v[':key'])),level:1,ability:(ABILITY_KEYS.includes(local(v[':ability']) as AbilityKey)?local(v[':ability']):'cha') as AbilityKey,usage:/^shadow touched$/i.test(draft.name)?'Available from character level 1. Casting limits need review.':'Imported spell: confirm character unlock level and casting limits.',needsReview:true}}),
    }
    draft.magic.enabled=false;draft.attacks=[];draft.skillCount=0
    const knownProps=new Set([':armor-prof',':weapon-prof',':skill-prof',':damage-resistance',':damage-immunity',':lizardfolk-ac'])
    const additional=Object.entries(props).filter(([key,value])=>!knownProps.has(key)&&value!==false&&value!==null).map(([key,value])=>`${title(local(key))}: ${typeof value==='boolean'?'granted':typeof value==='object'?Object.entries(plainObject(value)).filter(([,v])=>v!==false).map(([k,v])=>`${title(local(k))}${v===true?'':` ${String(v)}`}`).join(', '):String(value)}`).filter(line=>!line.endsWith(': '))
    for(const [key,value] of Object.entries(profs)){const options=plainObject(value);if(key.endsWith('-options')&&Object.keys(plainObject(options[':options'])).length){const count=options[':choose']??options[':num'];additional.push(`${title(local(key))}${count===undefined?' (selection count not specified)':` — choose ${count}`}: ${enabled(options[':options']).map(title).join(', ')}. Review the character’s existing selections.`)}}
    if(additional.length)draft.features.push({...newWorkshopFeature(),id:stable(5000),name:'Additional racial rules & choices',description:additional.join('\n\n')})
    draft.updatedAt='1970-01-01T00:00:00.000Z'
    if(/^shadow touched$/i.test(draft.name))draft.resources=[{...newWorkshopResource(),id:stable(3000),name:'Step through the shadows',level:3,basis:'ability',minimum:1,unlimitedAt:14,recovery:'long',notes:'CON modifier, minimum 1. Unlimited from character level 14.'}]
  }
  return draft
}
export const scheduleAt=(schedule:WorkshopSchedule[],level:number)=>[...schedule].filter(row=>row.level<=level).sort((a,b)=>b.level-a.level)[0]?.total??0
export function workshopResourceAt(r:WorkshopResource,level:number,scores:Record<AbilityKey,number>,proficiencyLevel=level) {
  if(level<r.level)return {maximum:0,unlimited:false,formula:`Available at level ${r.level}`}
  const value=r.basis==='level'?level:r.basis==='ability'?abilityMod(scores[r.ability]):r.basis==='proficiency'?profBonus(proficiencyLevel):0
  const maximum=Math.max(r.minimum,Math.floor(r.base+r.multiplier*value))
  const basis=r.basis==='fixed'?'':r.basis==='level'?`level ${level}`:r.basis==='ability'?`${r.ability.toUpperCase()} modifier ${value}`:`proficiency ${value}`
  return {maximum,unlimited:r.unlimitedAt!==null&&level>=r.unlimitedAt,formula:r.basis==='fixed'?`${r.base} fixed`:`${r.multiplier} × ${basis} + ${r.base}${r.minimum?` (minimum ${r.minimum})`:''}`}
}
export function workshopSlots(draft:WorkshopDraft,level:number) {
  return draft.magic.enabled&&level>=draft.magic.startsAt?slotMaximums(draft.magic.progression,level):Object.fromEntries(Array.from({length:9},(_,i)=>[`l${i+1}`,0]))
}
export function workshopProblems(d:WorkshopDraft):string[] {
  const result:string[]=[],whole=(n:number,min:number,max:number)=>Number.isInteger(n)&&n>=min&&n<=max
  if(!d.name.trim())result.push('Give your creation a name.')
  if(!d.source.trim())result.push('Choose a source or collection name.')
  if(d.kind==='race'&&(!d.race||!whole(d.race.speed,0,1000)||!whole(d.race.darkvision,0,1000)||!d.race.size.trim()||ABILITY_KEYS.some(k=>!whole(d.race!.abilityBonuses[k],-10,10))))result.push('Review the race’s size, speed, vision, and ability bonuses.')
  if(d.kind==='subclass'&&!d.parentClass.trim())result.push('Choose the class this subclass belongs to.')
  if(d.kind==='class'&&![4,6,8,10,12].includes(d.hitDie))result.push('Choose a valid hit die.')
  if(d.kind==='class'&&(!whole(d.subclassLevel,1,20)||d.asiLevels.some(l=>!whole(l,1,20))))result.push('Progression levels must be from 1 to 20.')
  if(d.kind==='class'&&(!whole(d.skillCount,0,d.skillOptions.length)||!whole(d.expertiseCount,0,18)))result.push('Review skill choices and expertise counts.')
  if(d.magic.enabled&&!whole(d.magic.startsAt,1,20))result.push('Check the first spellcasting level.')
  for(const [label,rows] of [['Cantrips',d.magic.cantrips],['Spells',d.magic.spells],['Attacks',d.attacks]] as const){
    if(rows.some(r=>!whole(r.level,1,20)||!whole(r.total,0,99))||new Set(rows.map(r=>r.level)).size!==rows.length)result.push(`${label}: use unique levels 1–20 and whole totals 0–99.`)
    const ordered=[...rows].sort((a,b)=>a.level-b.level);if(ordered.some((r,i)=>i>0&&r.total<ordered[i-1]!.total))result.push(`${label}: totals cannot decrease at later levels.`)
  }
  if(d.resources.some(r=>!r.name.trim()||!whole(r.level,1,20)||!whole(r.multiplier,0,99)||!whole(r.base,0,999)||!whole(r.minimum,0,999)||r.unlimitedAt!==null&&!whole(r.unlimitedAt,r.level,20)||ABILITY_KEYS.some(key=>workshopResourceAt(r,20,Object.fromEntries(ABILITY_KEYS.map(k=>[k,k===key?35:10])) as Record<AbilityKey,number>).maximum>999)))result.push('Trackers need a name, valid levels, and whole totals no higher than 999.')
  if(new Set(d.resources.map(r=>r.name.trim().toLowerCase())).size!==d.resources.length)result.push('Give each resource tracker a distinct name within this class or subclass.')
  if(d.features.some(f=>!f.name.trim()||!whole(f.level,1,20)||f.choice&&(!whole(f.choose,1,99)||f.options.length<f.choose&&f.originalSelection===undefined)))result.push('Features need names and levels. New choices need at least as many options as players may choose.')
  return result
}
