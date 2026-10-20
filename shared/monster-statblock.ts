/** Read-only presentation data shared by imported/SRD readers and a future editor.
 * Missing statistics stay null; descriptions never stand in for executable rules. */
export const MONSTER_ABILITIES=['str','dex','con','int','wis','cha'] as const
export type MonsterAbility=typeof MONSTER_ABILITIES[number]
export type MonsterSectionKind='traits'|'actions'|'bonus-actions'|'reactions'|'legendary-actions'|'mythic-actions'|'lair-actions'|'regional-effects'
export interface MonsterRule {
  name:string
  description:string
  usage:string
  mechanics?:Record<string,unknown>
}
export interface MonsterStatblock {
  name:string
  size:string
  type:string
  subtype:string
  alignment:string
  description:string
  source:string
  armorClass:{value:number|null;note:string}[]
  hitPoints:number|null
  hitDice:string
  speed:string
  abilities:Record<MonsterAbility,number|null>
  saves:Partial<Record<MonsterAbility,number>>
  skills:{name:string;bonus:number}[]
  vulnerabilities:string
  resistances:string
  damageImmunities:string
  conditionImmunities:string
  senses:string
  languages:string
  challenge:number|string|null
  xp:number|null
  proficiencyBonus:number|null
  sections:{kind:MonsterSectionKind;title:string;description:string;entries:MonsterRule[]}[]
  missing:string[]
}

type Data=Record<string,unknown>
const record=(value:unknown):Data=>value&&typeof value==='object'&&!Array.isArray(value)?value as Data:{}
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[]
const get=(value:Data,key:string)=>value[key]??value[`:${key}`]??value[key.replace(/-/g,'_')]
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())?Number(value):null
const text=(value:unknown):string=>typeof value==='string'?value.replace(/^:/,'').trim():typeof value==='number'?String(value):''
const label=(value:string)=>value.replace(/^:/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').trim()
const title=(value:string)=>value.replace(/^./,letter=>letter.toUpperCase())
const named=(value:unknown)=>text(get(record(value),'name'))||text(value)
const joined=(value:unknown):string=>typeof value==='string'?text(value):Array.isArray(value)?value.map(named).filter(Boolean).join(', '):Object.entries(record(value)).filter(([,enabled])=>enabled===true).map(([key])=>label(key)).join(', ')
const signed=(value:number)=>value>=0?`+${value}`:String(value)

function armor(value:unknown,note=''):MonsterStatblock['armorClass'] {
  if(Array.isArray(value))return value.map(item=>armor(item)).flat()
  const n=number(value)
  if(n!==null)return [{value:n,note}]
  if(typeof value==='string')return [{value:null,note:text(value)}]
  const data=record(value),amount=number(get(data,'value')??get(data,'base'))
  const names=list(get(data,'armor')).map(named).filter(Boolean)
  const kind=text(get(data,'type'))
  const description=text(get(data,'description'))||names.join(', ')||(kind==='natural'?'natural armor':kind==='dex'?'unarmored':kind&&kind!=='armor'?label(kind):'')
  return amount!==null||description?[{value:amount,note:description}]:[]
}

function speeds(value:unknown):string {
  if(typeof value==='string')return text(value)
  if(typeof value==='number')return `${value} ft.`
  const data=record(value)
  return Object.entries(data).filter(([key,v])=>key.replace(/^:/,'')!=='hover'&&(typeof v==='string'||typeof v==='number'))
    .map(([key,v])=>`${label(key)==='walk'?'':`${label(key)} `}${typeof v==='number'?`${v} ft.`:v}`).join(', ')+(get(data,'hover')===true?' (hover)':'')
}

function usage(value:unknown):string {
  const data=record(value),kind=text(get(data,'type')),times=number(get(data,'times'))
  if(kind==='per day'&&times!==null)return `${times}/Day`
  if(kind==='recharge on roll'){
    const minimum=number(get(data,'min-value')),die=text(get(data,'dice')).match(/^1d(\d+)$/i)
    if(minimum!==null&&die)return `Recharge ${minimum}${minimum<Number(die[1])?`–${die[1]}`:''}`
  }
  if(kind==='recharge after rest')return `Recharges after ${joined(get(data,'rest-types'))||'a rest'}`
  return ''
}

const sectionTitles:Record<MonsterSectionKind,string>={traits:'Traits',actions:'Actions','bonus-actions':'Bonus Actions',reactions:'Reactions','legendary-actions':'Legendary Actions','mythic-actions':'Mythic Actions','lair-actions':'Lair Actions','regional-effects':'Regional Effects'}
const sectionOf=(value:string):MonsterSectionKind|undefined=>({trait:'traits',ability:'traits',action:'actions','bonus-action':'bonus-actions',reaction:'reactions','legendary-action':'legendary-actions','mythic-action':'mythic-actions','lair-action':'lair-actions','regional-effect':'regional-effects'} as Record<string,MonsterSectionKind>)[value.toLowerCase().replace(/^:/,'').replace(/s$/,'')]

export function monsterStatblock(value:unknown):MonsterStatblock {
  const entry=record(value),details=record(entry.details)
  const imported=Object.keys(details).some(key=>key.startsWith(':'))
  // Old Orcbrew normalisation supplies fallback zeroes. Read original fields so
  // an absent challenge/HP is not presented as a real CR 0 / zero-HP monster.
  const data=imported?details:entry,props=record(get(data,'props'))
  const choose=(key:string,...aliases:string[])=>[key,...aliases].map(key=>get(data,key)).find(v=>v!==undefined&&v!==null)
  const abilities=Object.fromEntries(MONSTER_ABILITIES.map((key,index)=>[key,number(choose(key,['strength','dexterity','constitution','intelligence','wisdom','charisma'][index]!))])) as MonsterStatblock['abilities']
  const saves:MonsterStatblock['saves']={},skills:MonsterStatblock['skills']=[]
  for(const [key,amount]of Object.entries(record(choose('saving-throws','saves')))){
    const ability=label(key).slice(0,3) as MonsterAbility,n=number(amount)
    if(MONSTER_ABILITIES.includes(ability)&&n!==null)saves[ability]=n
  }
  for(const [key,amount]of Object.entries(record(choose('skills')))){const n=number(amount);if(n!==null)skills.push({name:title(label(key)),bonus:n})}
  for(const item of list(choose('proficiencies'))){
    const p=record(item),ref=record(get(p,'proficiency')),key=text(get(ref,'index')),name=text(get(ref,'name')),n=number(get(p,'value'))
    if(n===null)continue
    const ability=(key.match(/^saving-throw-(str|dex|con|int|wis|cha)$/)?.[1]??name.match(/^Saving Throw:\s*(STR|DEX|CON|INT|WIS|CHA)$/i)?.[1]?.toLowerCase()) as MonsterAbility|undefined
    if(ability)saves[ability]=n
    else if(key.startsWith('skill-')||/^Skill:/i.test(name))skills.push({name:name.replace(/^Skill:\s*/i,'')||title(label(key.slice(6))),bonus:n})
  }
  const hp=choose('hit-points'),hpData=record(hp),count=number(get(hpData,'die-count')),die=number(get(hpData,'die')),modifier=number(get(hpData,'modifier'))??0
  const hitPoints=number(hp)??number(get(hpData,'average'))??(count!==null&&die!==null&&count>0&&die>0?Math.floor(count*(die+1)/2+modifier):null)
  const hitDice=count!==null&&die!==null&&count>0&&die>0?`${count}d${die}${modifier?` ${modifier>0?'+':'−'} ${Math.abs(modifier)}`:''}`:text(choose('hit-points-roll','hit-dice'))
  const armorClass=armor(choose('armor-class'),text(choose('armor-notes')))
  const speed=speeds(choose('speed'))
  const rawChallenge=choose('challenge-rating','challenge'),fraction=text(rawChallenge).match(/^(\d+)\/(\d+)$/)
  const challenge=number(rawChallenge)??(fraction&&Number(fraction[2])!==0?Number(fraction[1])/Number(fraction[2]):text(rawChallenge)||null)
  const sections=(Object.entries(sectionTitles) as [MonsterSectionKind,string][]).map(([kind,title])=>({kind,title,description:'',entries:[] as MonsterRule[]}))
  const add=(target:MonsterSectionKind,item:unknown)=>{
    const d=record(item),originalName=text(get(d,'name')),prefix=originalName.match(/^(Bonus Actions?|Reactions?|Legendary Actions?|Mythic Actions?|Lair Actions?|Regional Effects?):\s*/i)
    const explicit=sectionOf(text(get(d,'type')))
    const kind=explicit??(prefix?sectionOf(prefix[1]!.toLowerCase().replace(/ /g,'-')):undefined)??target
    const name=prefix?originalName.slice(prefix[0].length):originalName
    const description=text(get(d,'desc')??get(d,'description'))||text(item)
    if(!name&&!description)return
    const rule:MonsterRule={name:name||'Unnamed feature',description,usage:usage(get(d,'usage')),mechanics:d}
    const group=sections.find(group=>group.kind===kind)!
    if(!group.entries.some(existing=>existing.name===rule.name&&existing.description===rule.description))group.entries.push(rule)
  }
  for(const item of [...list(choose('special-abilities')),...list(choose('traits'))])add('traits',item)
  for(const section of sections.filter(s=>s.kind!=='traits')){
    const source=choose(section.kind),container=record(source)
    section.description=text(get(container,'description')??get(container,'desc'))
    for(const item of Array.isArray(source)?source:list(get(container,'actions')??get(container,'entries')))add(section.kind,item)
  }
  const senseData=choose('senses')
  const senses=typeof senseData==='string'?senseData:Object.entries(record(senseData)).map(([name,value])=>`${label(name)} ${text(value)}`).filter(line=>line.trim()).join(', ')
  const missing:string[]=[]
  if(!armorClass.length)missing.push('armor class')
  if(hitPoints===null)missing.push('hit points')
  if(!speed)missing.push('speed')
  const missingAbilities=MONSTER_ABILITIES.filter(key=>abilities[key]===null)
  if(missingAbilities.length)missing.push(`${missingAbilities.map(key=>key.toUpperCase()).join(', ')} scores`)
  if(challenge===null)missing.push('challenge rating')
  return {
    name:text(entry.name)||text(get(data,'name'))||'Unnamed monster',size:title(text(choose('size'))),type:text(choose('type')),subtype:text(choose('subtype','tag')),
    alignment:text(choose('alignment')),source:text(entry.sourcePack)||text(entry.source)||text(choose('option-pack'))||(imported?'Imported content':'SRD 2014'),
    description:text(choose('description')),armorClass,hitPoints,hitDice,speed,abilities,saves,skills,
    vulnerabilities:joined(choose('damage-vulnerabilities')??get(props,'damage-vulnerability')),
    resistances:joined(choose('damage-resistances')??get(props,'damage-resistance')),
    damageImmunities:joined(choose('damage-immunities')??get(props,'damage-immunity')),
    conditionImmunities:joined(choose('condition-immunities')??get(props,'condition-immunity')),
    senses,languages:joined(choose('languages')??get(props,'language')),challenge,
    xp:number(choose('xp')),proficiencyBonus:number(choose('proficiency-bonus')),sections:sections.filter(s=>s.entries.length||s.description),missing,
  }
}

export const monsterModifier=(score:number)=>Math.floor((score-10)/2)
export const monsterSigned=signed
export const monsterChallenge=(value:number|string|null)=>value===null?'Not recorded':typeof value==='number'?({0.125:'1/8',0.25:'1/4',0.5:'1/2'} as Record<number,string>)[value]??String(value):value
