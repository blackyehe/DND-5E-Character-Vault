import { convertFiveToolsRecord, fiveToolsText, type FiveToolsRecord } from './five-tools-monster'

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const str=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):''
const sizes:Record<string,string>={T:'Tiny',S:'Small',M:'Medium',L:'Large',H:'Huge',G:'Gargantuan'}
const alignments:Record<string,string>={L:'lawful',N:'neutral',C:'chaotic',G:'good',E:'evil',U:'unaligned',A:'any alignment',NX:'neutral',NY:'neutral'}
const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null
function defense(value:unknown,kind:string):string {
  if(value===null||value===undefined)return ''
  if(typeof value==='string')return value
  if(Array.isArray(value))return value.map(v=>defense(v,kind)).filter(Boolean).join('; ')
  const v=obj(value)
  return [str(v.preNote),defense(v[kind],kind),str(v.note),str(v.special)].filter(Boolean).join(' ')
}
function movement(value:unknown):string {
  if(typeof value==='string'||typeof value==='number')return str(value)+(typeof value==='number'?' ft.':'')
  const v=obj(value),parts:string[]=[]
  for(const mode of ['walk','burrow','climb','fly','swim']){
    const raw=v[mode],n=typeof raw==='number'?raw:obj(raw).number,condition=str(obj(raw).condition)
    if(n!==undefined)parts.push(`${mode==='walk'?'':mode+' '}${str(n)} ft.${condition?' '+condition:''}${mode==='fly'&&v.canHover?' (hover)':''}`)
  }
  if(v.choose){const c=obj(v.choose);parts.push(`${arr(c.from).map(str).join(' or ')} ${str(c.amount)} ft.${c.note?' '+str(c.note):''}`)}
  for(const [mode,values]of Object.entries(obj(v.alternate)))for(const raw of arr(values)){const o=obj(raw);parts.push(`${mode} ${str(o.number)} ft.${o.condition?' '+str(o.condition):''}`)}
  for(const key of ['special','note'])if(v[key])parts.push(str(v[key]))
  return parts.join(', ')
}
/** Full source records remain attached; the portable EDN fields feed the existing reader. */
export function fiveToolsOrcbrewMonster(record:FiveToolsRecord,snapshot:string,sourceName:string,key:string) {
  const m=record.monster,reference=convertFiveToolsRecord(record,snapshot,sourceName),hp=obj(m.hp),cr=obj(m.cr),type=obj(m.type)
  const size=arr(m.size).map(v=>sizes[str(v)]??str(v)),extended={...reference.extended,sizes:size,aliases:reference.aliases,family:reference.family,
    provenance:{format:'5etools',original:JSON.stringify(record),notes:`Resolved ${snapshot}; source ${str(m.source)}. Original source record retained without dropping unsupported fields.`}}
  const specialHp=str(hp.special),initiative=obj(m.initiative)
  if(specialHp)Object.assign(extended,{hpText:fiveToolsText(specialHp)})
  if(typeof m.initiative==='number')Object.assign(extended,{initiative:m.initiative})
  else if(typeof initiative.initiative==='number')Object.assign(extended,{initiative:initiative.initiative})
  if(typeof initiative.passive==='number')Object.assign(extended,{initiativeScore:initiative.passive})
  if(cr.lair!==undefined)Object.assign(extended,{xpNote:`Challenge in lair: ${str(cr.lair)}${cr.coven!==undefined?'; in coven: '+str(cr.coven):''}`})
  else if(cr.coven!==undefined)Object.assign(extended,{xpNote:'Challenge in coven: '+str(cr.coven)})
  const armor=arr(m.ac).map(v=>typeof v==='number'?{value:v,note:''}:{value:numeric(obj(v).ac),note:[fiveToolsText(obj(v).from),fiveToolsText(obj(v).condition),fiveToolsText(obj(v).special),obj(v).braces?'conditional armor':''].filter(Boolean).join('; ')})
  const challenge=str(cr.cr??m.cr),fraction=challenge.match(/^(\d+)\/(\d+)$/),challengeNumber=fraction?Number(fraction[1])/Number(fraction[2]):challenge.trim()&&Number.isFinite(Number(challenge))?Number(challenge):null
  const xpByCr:Record<string,number>={'0':10,'1/8':25,'1/4':50,'1/2':100,'1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,'7':2900,'8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,'14':11500,'15':13000,'16':15000,'17':18000,'18':20000,'19':22000,'20':25000,'21':33000,'22':41000,'23':50000,'24':62000,'25':75000,'26':90000,'27':105000,'28':120000,'29':135000,'30':155000}
  if(cr.lair!==undefined&&xpByCr[str(cr.lair)]!==undefined)Object.assign(extended,{lairXp:xpByCr[str(cr.lair)]})
  if(typeof cr.xpLair==='number')Object.assign(extended,{lairXp:cr.xpLair})
  const pb=typeof m.pbNote==='number'?m.pbNote:challengeNumber===null?null:Math.max(2,Math.ceil(challengeNumber/4)+1)
  if(typeof initiative.proficiency==='number'&&numeric(m.dex)!==null&&pb!==null)Object.assign(extended,{initiative:Math.floor((Number(m.dex)-10)/2)+initiative.proficiency*pb})
  const alignment=arr(m.alignment).every(v=>typeof v==='string')?arr(m.alignment).map(v=>alignments[str(v)]??str(v)).join(' '):arr(m.alignment).map(v=>{const o=obj(v);return o.special?str(o.special):arr(o.alignment).map(v=>alignments[str(v)]??str(v)).join(' ')+(o.chance!==undefined?` (${o.chance}%)`:'')}).join(' or ')
  const additions=[m.skill&&obj(m.skill).other?{':name':'Additional skill options',':description':fiveToolsText(obj(m.skill).other)}:null,
    m.gear?{':name':'Gear',':description':fiveToolsText(m.gear)}:null,
    m.pbNote?{':name':'Proficiency bonus notes',':description':str(m.pbNote)}:null,
    initiative.advantageMode?{':name':'Initiative notes',':description':str(initiative.advantageMode)}:null,
  ].filter((v):v is {':name':string;':description':string}=>!!v)
  const traits=reference.sections.find(s=>s.kind==='traits')
  return {':name':str(m.name),':key':':'+key,':option-pack':str(m.source),':disabled?':false,':codex/extended':extended,
    ':size':':'+(size[0]??'').toLowerCase(),':codex/size':size.join(' or ')+(m.sizeNote?' '+str(m.sizeNote):''),':type':typeof m.type==='string'?m.type:type.swarmSize?`swarm of ${(sizes[str(type.swarmSize)]??str(type.swarmSize)).toLowerCase()} ${str(type.type)}s`:str(type.type),':subtype':arr(type.tags).map(v=>typeof v==='string'?v:[str(obj(v).prefix),str(obj(v).tag)].filter(Boolean).join(' ')).join(', '),':alignment':[str(m.alignmentPrefix),alignment].filter(Boolean).join(' '),
    ...Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[':'+k,numeric(m[k])])),
    ':armor-class':armor[0]?.value??null,':codex/armor-class':armor,':hit-points':numeric(hp.average),':hit-points-roll':str(hp.formula),':speed':movement(m.speed),
    ':saving-throws':Object.fromEntries(Object.entries(obj(m.save)).filter(([,v])=>/^[+-]?\d+$/.test(str(v))).map(([k,v])=>[':'+k,Number(v)])),
    ':skills':Object.fromEntries(Object.entries(obj(m.skill)).filter(([k,v])=>k!=='other'&&/^[+-]?\d+$/.test(str(v))).map(([k,v])=>[':'+k.replace(/ /g,'-'),Number(v)])),
    ':damage-vulnerabilities':defense(m.vulnerable,'vulnerable'),':damage-resistances':defense(m.resist,'resist'),':damage-immunities':defense(m.immune,'immune'),':condition-immunities':defense(m.conditionImmune,'conditionImmune'),
    ':senses':[...arr(m.senses).map(str),m.passive!==undefined?'passive Perception '+str(m.passive):''].filter(Boolean).join(', '),':languages':arr(m.languages).map(str).join(', '),
    ':challenge':challengeNumber,':challenge-rating':challenge||null,':xp':numeric(cr.xp)??xpByCr[challenge]??null,':proficiency-bonus':pb,
    ...Object.fromEntries(reference.sections.map(s=>[':'+s.kind,s.kind==='traits'?[...(s.description?[{':name':'Traits',':description':s.description}]:[]),...s.entries.map(r=>({':name':r.name,':description':r.description}))]:{':description':s.description,':entries':s.entries.map(r=>({':name':r.name,':description':r.description}))}])),
    ':traits':[...(traits?.entries??[]).map(r=>({':name':r.name,':description':r.description})),...additions],
  }
}
