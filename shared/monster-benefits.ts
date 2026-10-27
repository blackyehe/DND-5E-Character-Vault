import type { MonsterStatblock, MonsterAbility } from './monster-statblock'
import { SKILL_ABILITY } from './calc'
import { entryBenefits, benefitField, benefitKey, benefitProblems, benefitSummary, benefitTitle } from './rule-benefits'
export const MONSTER_BENEFIT_TYPES=['damage-resistance','damage-immunity','damage-vulnerability','condition-immunity','saving-throw-advantage','skill-prof','skill-expertise','saving-throw-prof','language','walking-speed','flying-speed','flying-speed-equals-walking-speed','swimming-speed','climbing-speed','burrowing-speed','darkvision','blindsight','truesight','ac-bonus','saving-throw-bonus','initiative-bonus']
/** Creature statistics have their own base values; never treat CR as class level. */
export function applyMonsterRuleBenefits(m:MonsterStatblock,entry:unknown):MonsterStatblock{
 const rows=entryBenefits(entry).filter(row=>benefitProblems([row]).length===0),c=JSON.parse(JSON.stringify(m)) as MonsterStatblock
 const append=(base:string,value:string)=>base.split(/,\s*/).some(v=>v.toLowerCase()===value.toLowerCase())?base:[base,value].filter(Boolean).join(', ')
 const speeds:Record<string,number>={},senses:Record<string,number>={},notes:string[]=[],seen=new Set<string>()
 let saveBonus=0
 for(const row of rows){
  const type=benefitKey(benefitField(row,'type')),v=benefitField(row,'value'),key=benefitKey(v),n=Number(v)
  const identity=JSON.stringify([type,v]);if(seen.has(identity))continue;seen.add(identity)
  if(!MONSTER_BENEFIT_TYPES.includes(type)){notes.push(benefitSummary(row)+' — this creature rule requires manual adjudication.');continue}
  const defense=({'damage-resistance':'resistances','damage-immunity':'damageImmunities','damage-vulnerability':'vulnerabilities','condition-immunity':'conditionImmunities'} as const)[type as 'damage-resistance']
  if(defense){c[defense]=append(c[defense],benefitTitle(key));continue}
  const speed=({'walking-speed':'walk','flying-speed':'fly','swimming-speed':'swim','climbing-speed':'climb','burrowing-speed':'burrow'} as const)[type as 'walking-speed']
  if(speed){speeds[speed]=Math.max(speeds[speed]??0,n);continue}
  if(['darkvision','blindsight','truesight'].includes(type)){senses[type]=Math.max(senses[type]??0,n);continue}
  if(type==='language'){c.languages=append(c.languages,key);continue}
  if(type==='ac-bonus'){c.armorClass.forEach(a=>{if(a.value!==null)a.value+=n});continue}
  if(type==='initiative-bonus'){c.extended??={};const dex=c.abilities.dex;if(c.extended.initiative!==undefined&&c.extended.initiative!==null)c.extended.initiative+=n;else if(dex!==null)c.extended.initiative=Math.floor((dex-10)/2)+n;else notes.push(benefitSummary(row)+' — Dexterity is not recorded.');continue}
  if(type==='saving-throw-bonus'){saveBonus+=n;continue}
  if(type==='saving-throw-prof'){const a=key as MonsterAbility,score=c.abilities[a];if(score!==null&&score!==undefined&&c.proficiencyBonus!==null)c.saves[a]=Math.max(c.saves[a]??-Infinity,Math.floor((score-10)/2)+c.proficiencyBonus);else notes.push(benefitSummary(row)+' — ability or proficiency bonus is not recorded.');continue}
  if(type==='skill-prof'||type==='skill-expertise'){const skill=Object.keys(SKILL_ABILITY).find(s=>s.toLowerCase()===key.replace(/[-_]/g,'').toLowerCase()),a=skill?SKILL_ABILITY[skill]:undefined,score=a?c.abilities[a]:null;if(score!==null&&c.proficiencyBonus!==null){const bonus=Math.floor((score!-10)/2)+c.proficiencyBonus*(type==='skill-expertise'?2:1),old=c.skills.find(s=>s.name.replace(/\s/g,'').toLowerCase()===skill?.toLowerCase());if(old)old.bonus=Math.max(old.bonus,bonus);else c.skills.push({name:benefitTitle(skill),bonus})}else notes.push(benefitSummary(row)+' — ability or proficiency bonus is not recorded.');continue}
  notes.push(benefitSummary(row))
 }
 if(saveBonus)for(const a of Object.keys(c.abilities) as MonsterAbility[]){const score=c.abilities[a];if(score!==null)c.saves[a]=(c.saves[a]??Math.floor((score-10)/2))+saveBonus}
 for(const [key,value]of Object.entries(speeds)){const pattern=new RegExp(`(?:^|,\\s*)${key==='walk'?'(?:walk\\s+)?':key+'\\s+'}(\\d+)\\s*ft\\.?`,'i'),match=c.speed.match(pattern);if(match&&Number(match[1])>=value)continue;c.speed=match?c.speed.replace(pattern,`${match[0].startsWith(',')?', ':''}${key==='walk'?'':key+' '}${value} ft.`):append(c.speed,`${key==='walk'?'':key+' '}${value} ft.`)}
 if(rows.some(r=>benefitKey(benefitField(r,'type'))==='flying-speed-equals-walking-speed')){const walking=c.speed.match(/^(?:walk\s+)?(\d+)\s*ft/i);if(walking){const fly=c.speed.match(/fly\s+(\d+)\s*ft/i);if(!fly)c.speed=append(c.speed,`fly ${walking[1]} ft.`);else if(Number(fly[1])<Number(walking[1]))c.speed=c.speed.replace(/fly\s+\d+\s*ft\.?/i,`fly ${walking[1]} ft.`)}else notes.push('Flying speed equals walking speed — walking speed is not recorded.')}
 for(const [key,n]of Object.entries(senses)){const pattern=new RegExp(`${key}\\s+(\\d+)\\s*ft\\.?`,'i'),match=c.senses.match(pattern);if(!match)c.senses=append(c.senses,`${benefitTitle(key)} ${n} ft.`);else if(Number(match[1])<n)c.senses=c.senses.replace(pattern,`${benefitTitle(key)} ${n} ft.`)}
 if(notes.length)c.sections.push({kind:'traits',title:'Additional benefits',description:'',entries:notes.map(description=>({name:'Rule benefit',description,usage:''}))})
 return c
}
