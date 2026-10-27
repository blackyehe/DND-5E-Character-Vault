import type { Character } from './character'
import { itemActive } from './item-rules'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod, profBonus, type AbilityKey, type Proficiency } from '../src/lib/calc'

export const DAMAGE_TYPES=['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'] as const
export const CONDITIONS=['blinded','charmed','deafened','exhaustion','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious'] as const
export const TOOLS=["Alchemist's supplies","Brewer's supplies","Calligrapher's supplies","Carpenter's tools","Cartographer's tools","Cobbler's tools","Cook's utensils","Glassblower's tools","Jeweler's tools","Leatherworker's tools","Mason's tools","Painter's supplies","Potter's tools","Smith's tools","Tinker's tools","Weaver's tools","Woodcarver's tools","Disguise kit","Forgery kit","Herbalism kit","Navigator's tools","Poisoner's kit","Thieves' tools","Dice set","Dragonchess set","Playing card set","Three-Dragon Ante set","Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan flute","Shawm","Viol"]
export const WEAPONS=['simple','martial','club','dagger','greatclub','handaxe','javelin','light-hammer','mace','quarterstaff','sickle','spear','light-crossbow','dart','shortbow','sling','battleaxe','flail','glaive','greataxe','greatsword','halberd','lance','longsword','maul','morningstar','pike','rapier','scimitar','shortsword','trident','war-pick','warhammer','whip','blowgun','hand-crossbow','heavy-crossbow','longbow','net']
export const LANGUAGES=['Common','Dwarvish','Elvish','Giant','Gnomish','Goblin','Halfling','Orc','Abyssal','Celestial','Draconic','Deep Speech','Infernal','Primordial','Sylvan','Undercommon','Druidic',"Thieves' Cant"]
export const benefitObject=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
export const benefitKey=(v:unknown)=>String(v??'').replace(/^:/,'').split('/').pop()!
export const benefitField=(v:unknown,k:string)=>benefitObject(v)[k]??benefitObject(v)[`:${k}`]
export const benefitTitle=(v:unknown)=>({str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'} as Record<string,string>)[benefitKey(v)]??benefitKey(v).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase())
type BenefitSpec={label:string;values?:readonly string[];min?:number;max?:number;unit?:string;flag?:boolean;spell?:boolean;hint:string}
export const BENEFIT_TYPES:Record<string,BenefitSpec>={
 'damage-resistance':{label:'Damage resistance',values:DAMAGE_TYPES,hint:'Halves matching damage, rounded down.'},
 'damage-immunity':{label:'Damage immunity',values:DAMAGE_TYPES,hint:'Prevents matching damage.'},
 'damage-vulnerability':{label:'Damage vulnerability',values:DAMAGE_TYPES,hint:'Doubles matching damage.'},
 'condition-immunity':{label:'Condition immunity',values:CONDITIONS,hint:'Records immunity in defenses; condition tracking remains manual.'},
 'saving-throw-advantage':{label:'Saving throw advantage',values:CONDITIONS,hint:'Shows the condition against which saves have advantage; roll two d20s and keep the higher.'},
 'skill-prof':{label:'Skill proficiency',values:Object.keys(SKILL_ABILITY),hint:'Uses proficiency when calculating this skill.'},
 'skill-expertise':{label:'Skill expertise',values:Object.keys(SKILL_ABILITY),hint:'Uses twice proficiency when calculating this skill.'},
 'saving-throw-prof':{label:'Saving throw proficiency',values:ABILITY_KEYS,hint:'Adds proficiency to this saving throw.'},
 'armor-prof':{label:'Armor proficiency',values:['light','medium','heavy','shields'],hint:'Adds armor training to the character’s proficiencies.'},
 'weapon-prof':{label:'Weapon proficiency',values:WEAPONS,hint:'Adds weapon training and applies proficiency to matching attacks.'},
 'tool-prof':{label:'Tool proficiency',values:TOOLS,hint:'Adds tool training to the character’s proficiencies.'},
 language:{label:'Language',values:LANGUAGES,hint:'Adds a language to the character’s proficiencies.'},
 'num-attacks':{label:'Attacks per Attack action',min:1,max:10,hint:'Uses the highest granted total; extra attacks do not add together.'},
 'walking-speed':{label:'Walking speed',min:0,max:1000,unit:'ft.',hint:'Grants this walking speed if higher than the saved speed.'},
 'flying-speed':{label:'Flying speed',min:0,max:1000,unit:'ft.',hint:'Grants a flying speed.'},
 'flying-speed-equals-walking-speed':{label:'Flying speed equals walking speed',flag:true,hint:'Flying speed follows the effective walking speed.'},
 'swimming-speed':{label:'Swimming speed',min:0,max:1000,unit:'ft.',hint:'Grants a swimming speed.'},
 'climbing-speed':{label:'Climbing speed',min:0,max:1000,unit:'ft.',hint:'Grants a climbing speed.'},
 'burrowing-speed':{label:'Burrowing speed',min:0,max:1000,unit:'ft.',hint:'Grants a burrowing speed.'},
 darkvision:{label:'Darkvision',min:0,max:1000,unit:'ft.',hint:'Uses the longest granted darkvision distance.'},
 blindsight:{label:'Blindsight',min:0,max:1000,unit:'ft.',hint:'Uses the longest granted blindsight distance.'},
 truesight:{label:'Truesight',min:0,max:1000,unit:'ft.',hint:'Uses the longest granted truesight distance.'},
 'ac-bonus':{label:'Armor class bonus',min:-20,max:20,hint:'Adds to calculated armor class. Your saved base AC stays unchanged.'},
 'saving-throw-bonus':{label:'Saving throw bonus',min:-20,max:20,hint:'Adds to all saving throws.'},
 'initiative-bonus':{label:'Initiative bonus',min:-20,max:20,hint:'Adds to initiative.'},
 'attack-bonus':{label:'Weapon attack bonus',min:-20,max:20,hint:'Adds to weapon and custom attack rolls.'},
 'damage-bonus':{label:'Weapon damage bonus',min:-20,max:20,hint:'Adds to weapon and custom attack damage.'},
 'spell-attack-bonus':{label:'Spell attack bonus',min:-20,max:20,hint:'Adds to spell attack rolls.'},
 'spell-dc-bonus':{label:'Spell save DC bonus',min:-20,max:20,hint:'Adds to spell save DC.'},
 spell:{label:'Granted spell',spell:true,hint:'Makes the selected spell available with its own casting ability. Spending slots and limited uses remains manual.'},
}
export interface RuleBenefit {type:string;value?:unknown;level?:number;[key:string]:unknown}
export function newRuleBenefit(type='damage-resistance'):RuleBenefit {const s=BENEFIT_TYPES[type]!;return {type,level:1,...(s.flag?{}:{value:s.spell?{key:'',ability:'cha',level:0}:s.values?.[0]??(type==='num-attacks'?2:s.min===0?30:1)})}}
export function entryBenefits(entry:unknown):unknown[]{
 const e=benefitObject(entry),w=benefitObject(e.workshop),raw=benefitObject(e.details)
 // An authored edition replaces the imported modifier list, including an empty list.
 for(const v of [e.benefits,w.benefits])if(Array.isArray(v))return v
 const rows=Array.isArray(raw[':level-modifiers']??raw['level-modifiers'])?[...(raw[':level-modifiers']??raw['level-modifiers']) as unknown[]]:[]
 const props=benefitObject(raw[':props']??raw.props),race=benefitObject(w.race)
 for(const type of ['damage-resistance','damage-immunity','condition-immunity','saving-throw-advantage'])for(const [key,enabled]of Object.entries(benefitObject(props[':'+type]??props[type])))if(enabled===true)rows.push({type,value:key,level:1})
 for(const [field,type]of [['resistances','damage-resistance'],['immunities','damage-immunity']] as const)for(const value of Array.isArray(race[field])?race[field] as unknown[]:[])rows.push({type,value,level:1})
 return rows
}
export function benefitProblems(rows:unknown,original:unknown[]=[]):string[]{
 if(!Array.isArray(rows)||rows.length>200)return ['Use a benefit list with at most 200 entries.']
 return rows.flatMap((row,i)=>{
  const type=benefitKey(benefitField(row,'type')),s=Object.hasOwn(BENEFIT_TYPES,type)?BENEFIT_TYPES[type]:undefined,value=benefitField(row,'value'),level=benefitField(row,'level')??1,prefix=`Benefit ${i+1}: `
  if(original.some(old=>JSON.stringify(old)===JSON.stringify(row)))return []
  // Preserve unsupported imported definitions byte-for-byte; never execute them.
  if(!s)return original.some(old=>JSON.stringify(old)===JSON.stringify(row))?[]:[prefix+'choose a supported benefit type.']
  if(!Number.isInteger(level)||Number(level)<1||Number(level)>20)return [prefix+'choose an unlock level from 1 to 20.']
  if(s.values&&!s.values.some(v=>optionKey(v)===optionKey(value)))return [prefix+'choose a valid '+s.label.toLowerCase()+' value.']
  if(s.min!==undefined&&(!Number.isInteger(value)||Number(value)<s.min||Number(value)>s.max!))return [prefix+`enter a whole number from ${s.min} to ${s.max}.`]
  if(s.spell){const key=benefitKey(benefitField(value,'key')),ability=benefitKey(benefitField(value,'ability')),rank=benefitField(value,'level')??0;if(!key||key.length>200||!ABILITY_KEYS.includes(ability as AbilityKey)||!Number.isInteger(rank)||Number(rank)<0||Number(rank)>9)return [prefix+'choose a spell, spell level and casting ability.']}
  return []
 })
}
export function benefitSummary(row:unknown){const type=benefitKey(benefitField(row,'type')),s=BENEFIT_TYPES[type],v=benefitField(row,'value');return `${s?.label??benefitTitle(type)}${s?.flag?'':`: ${s?.spell?benefitTitle(benefitField(v,'key')):typeof v==='object'?JSON.stringify(v):benefitTitle(v)}${s?.unit?' '+s.unit:''}`}`}
const normalized=(v:unknown)=>String(v??'').trim().replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/^:/,'').replace(/[-_]/g,' ')
const optionKey=(v:unknown)=>benefitKey(v).toLowerCase().replace(/[^a-z0-9]/g,'')
function sameSource(e:Record<string,unknown>,index:string,v:unknown){return typeof v==='string'&&v.length>0&&[index,e.index,e.contentKey,...(Array.isArray(e.aliases)?e.aliases:[])].includes(v)}
function nameMatches(a:unknown,b:unknown){return normalized(a)===normalized(b)}
export function benefitDefinitionLevel(c:Character,kind:string,index:string,entry:Record<string,unknown>):number{
 const feature=c.features.some(f=>nameMatches(f.name,entry.name)||/^feats?$/i.test(f.name.trim())&&f.description.split(/[,;\n]+/).some(n=>nameMatches(n,entry.name)))
 if(kind==='classes'||kind==='subclasses'){
  const rows=c.meta.classLevels?.length?c.meta.classLevels:[{name:c.meta.klass,index:c.meta.classIndex,subclass:c.meta.subclass,subclassIndex:c.meta.subclassIndex,level:c.meta.level}]
  return rows.find(r=>{const id=kind==='classes'?r.index:r.subclassIndex;return id?sameSource(entry,index,id):nameMatches(kind==='classes'?r.name:r.subclass,entry.name)})?.level??0
 }
 if(kind==='races')return (c.meta.raceIndex?sameSource(entry,index,c.meta.raceIndex):nameMatches(c.meta.race,entry.name))?c.meta.level:0
 if(kind==='subraces')return nameMatches(c.meta.subrace,entry.name)?c.meta.level:0
 if(kind==='backgrounds')return nameMatches(c.meta.background,entry.name)?c.meta.level:0
 if(kind==='languages')return c.proficiencies.languages.some(n=>nameMatches(n,entry.name))?c.meta.level:0
 if(kind==='equipment'||kind==='magic-items')return c.equipment.some(i=>itemActive(i)&&(i.index||i.magicIndex||i.templateId?sameSource(entry,index,i.index)||sameSource(entry,index,i.magicIndex)||index===`workshop-item-${i.templateId}`:nameMatches(i.name,entry.name)))?c.meta.level:0
 if(kind==='spells')return benefitKnownSpellIds(c).some(id=>sameSource(entry,index,id))&&c.spellcasting.activeEffects?.includes(index)?c.meta.level:0
 if(kind==='monsters')return 0
 return feature?c.meta.level:0
}
export function benefitKnownSpellIds(c:Character):string[]{
 const ids=[...c.spellcasting.known,...c.spellcasting.prepared,...(c.homebrew?.bindings??[]).filter(b=>b.rule.kind==='race').flatMap(b=>(b.rule.race?.spells??[]).filter(s=>s.level<=c.meta.level).map(s=>s.index))]
 for(const d of c.compendiumRules??[]){if(d.kind==='spells')continue;const level=benefitDefinitionLevel(c,d.kind,d.index,d.entry)||benefitDefinitionLevel(c,d.kind,d.index,d.before);if(!level)continue;for(const row of entryBenefits(d.entry))if(benefitKey(benefitField(row,'type'))==='spell'&&Number(benefitField(row,'level')??1)<=level&&benefitProblems([row]).length===0)ids.push(benefitKey(benefitField(benefitField(row,'value'),'key')))}
 return [...new Set(ids)]
}
export const availableBenefitSpells=(c:Character)=>(c.compendiumRules??[]).filter(d=>d.kind==='spells'&&entryBenefits(d.entry).length&&benefitKnownSpellIds(c).some(id=>sameSource(d.entry,d.index,id)))
export interface ActiveBenefit {source:string;kind:string;index:string;row:unknown;level:number;active:boolean}
export function characterBenefitRows(c:Character):ActiveBenefit[]{
 const rows:ActiveBenefit[]=[],approved=c.compendiumRules??[]
 for(const d of approved){const level=benefitDefinitionLevel(c,d.kind,d.index,d.entry)||benefitDefinitionLevel(c,d.kind,d.index,d.before);for(const row of entryBenefits(d.entry))rows.push({source:String(d.entry.name),kind:d.kind,index:d.index,row,level,active:level>0&&Number(benefitField(row,'level')??1)<=level&&benefitProblems([row]).length===0})}
 for(const b of c.homebrew?.bindings??[]){if(approved.some(d=>d.index===b.index||d.entry.workshop&&benefitObject(d.entry.workshop).id===b.ruleId))continue;const kind=b.rule.kind==='class'?'classes':b.rule.kind==='race'?'races':'subclasses',entry={...b.rule.imported?.raw,name:b.rule.name,details:b.rule.imported?.raw,workshop:b.rule},level=benefitDefinitionLevel(c,kind,b.index,entry);for(const row of entryBenefits(entry))rows.push({source:b.rule.name,kind,index:b.index,row,level,active:level>0&&Number(benefitField(row,'level')??1)<=level&&benefitProblems([row]).length===0})}
 return rows
}
export function characterBenefits(c:Character){
 const skills={...c.skills},saves={...c.saves},proficiencies={armor:[...c.proficiencies.armor],weapons:[...c.proficiencies.weapons],tools:[...c.proficiencies.tools],languages:[...c.proficiencies.languages]}
 const effects={resistances:[] as string[],immunities:[] as string[],vulnerabilities:[] as string[],conditionImmunities:[] as string[],saveAdvantage:[] as string[],skills,saves,proficiencies,speed:c.combat.speed,fly:0,swim:0,climb:0,burrow:0,darkvision:0,blindsight:0,truesight:0,attacks:1,ac:0,saveBonus:0,initiative:0,attackBonus:0,damageBonus:0,spellAttack:0,spellDC:0}
 const seen=new Set<string>()
 for(const {source,kind,index,row,active} of characterBenefitRows(c)){
  if(!active)continue
  const type=benefitKey(benefitField(row,'type')),value=benefitField(row,'value'),key=BENEFIT_TYPES[type]?.values?.find(v=>optionKey(v)===optionKey(value))??benefitKey(value),n=Number(value),id=`${kind}:${index}:${type}:${JSON.stringify(value)}`
  if(seen.has(id))continue;seen.add(id)
  const defense=({'damage-resistance':'resistances','damage-immunity':'immunities','damage-vulnerability':'vulnerabilities','condition-immunity':'conditionImmunities','saving-throw-advantage':'saveAdvantage'} as const)[type as 'damage-resistance']
  if(defense){if(!effects[defense].includes(key))effects[defense].push(key);continue}
  if(type==='skill-prof'||type==='skill-expertise'){const skill=Object.keys(SKILL_ABILITY).find(k=>normalized(k)===normalized(key));if(skill)skills[skill]=skills[skill]==='expert'||type==='skill-expertise'?'expert':'prof';continue}
  if(type==='saving-throw-prof'){saves[key as AbilityKey]=true;continue}
  const training=({'armor-prof':'armor','weapon-prof':'weapons','tool-prof':'tools',language:'languages'} as const)[type as 'armor-prof']
  if(training){const label=type==='armor-prof'?key==='shields'?'Shields':`${benefitTitle(key)} armor`:type==='weapon-prof'?['simple','martial'].includes(key)?`All ${key} weapons`:benefitTitle(key):key;if(!proficiencies[training].some(v=>normalized(v)===normalized(label)))proficiencies[training].push(label);continue}
  const maximum=({'walking-speed':'speed','flying-speed':'fly','swimming-speed':'swim','climbing-speed':'climb','burrowing-speed':'burrow',darkvision:'darkvision',blindsight:'blindsight',truesight:'truesight','num-attacks':'attacks'} as const)[type as 'walking-speed']
  if(maximum){effects[maximum]=Math.max(effects[maximum],n);continue}
  const bonus=({'ac-bonus':'ac','saving-throw-bonus':'saveBonus','initiative-bonus':'initiative','attack-bonus':'attackBonus','damage-bonus':'damageBonus','spell-attack-bonus':'spellAttack','spell-dc-bonus':'spellDC'} as const)[type as 'ac-bonus']
  if(bonus)effects[bonus]+=n
  void source
 }
 if(characterBenefitRows(c).some(v=>v.active&&benefitKey(benefitField(v.row,'type'))==='flying-speed-equals-walking-speed'))effects.fly=Math.max(effects.fly,effects.speed)
 return effects
}
export function benefitSkillRank(c:Character,key:string):Proficiency{return characterBenefits(c).skills[key]??'none'}
export function benefitSpellAttack(c:Character){return abilityMod(c.abilities[c.spellcasting.ability])+profBonus(c.meta.level)+characterBenefits(c).spellAttack}
export function benefitSpellDC(c:Character){return 8+abilityMod(c.abilities[c.spellcasting.ability])+profBonus(c.meta.level)+characterBenefits(c).spellDC}
export function benefitDamage(amount:number,type:string,defenses:Pick<ReturnType<typeof characterBenefits>,'resistances'|'immunities'|'vulnerabilities'>){
 if(defenses.immunities.includes(type))return 0
 let result=Math.max(0,Math.floor(amount))
 if(defenses.resistances.includes(type))result=Math.floor(result/2)
 if(defenses.vulnerabilities.includes(type))result*=2
 return result
}
export function grantedBenefitSpells(c:Character){return characterBenefitRows(c).filter(r=>r.active&&benefitKey(benefitField(r.row,'type'))==='spell').map(r=>{const value=benefitField(r.row,'value');return {id:`${r.kind}:${r.index}:${benefitKey(benefitField(value,'key'))}`,index:benefitKey(benefitField(value,'key')),name:benefitTitle(benefitField(value,'key')),ability:benefitKey(benefitField(value,'ability')) as AbilityKey,level:Number(benefitField(r.row,'level')??1),usage:'Granted by '+r.source+'. Use the spell’s normal casting limits; track slots or limited uses manually.',needsReview:false,source:r.source}})}
