import type { MonsterAbility } from './monster-statblock'
import { fiveToolsMonsterToken,readMonsterToken,type MonsterToken } from './monster-token'

/** Optional additions keep existing version-1 drafts readable. */
export interface MonsterExtensions {
  token?:MonsterToken
  sourceInfo?: { id:string; edition:string; page:string; url:string }
  aliases?:string[]
  family?:string
  variant?:string
  sizes?:string[]
  initiative?:number|null
  initiativeScore?:number|null
  lairXp?:number|null
  xpNote?:string
  habitat?:string
  treasure?:string
  armorText?:string
  armorAlternatives?:{value:number|null;note:string}[]
  hpText?:string
  info?:{text:string;source:string;images:{url:string;title:string;credit:string}[]}
  unknown?:('armor'|'hp'|'speed'|'cr'|MonsterAbility)[]
  provenance?:{format:string;original:string;notes:string}
}
export interface MonsterSpellcasting {
  ability:MonsterAbility
  dc:number|null
  attack:number|null
  header:string
  footer:string
  groups:{label:string;spells:{name:string;source:string;edition:string}[]}[]
}

/** Imported packs may carry arbitrary metadata. Invalid extras stay available in
 * the original-reference panel rather than breaking the ordinary reader. */
export function readMonsterExtensions(value:unknown):MonsterExtensions {
  const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
  const raw=object(value),result:MonsterExtensions={}
  for(const key of ['family','variant','xpNote','habitat','treasure','armorText','hpText'] as const)if(typeof raw[key]==='string')result[key]=raw[key]
  for(const key of ['initiative','initiativeScore','lairXp'] as const)if(raw[key]===null||typeof raw[key]==='number'&&Number.isFinite(raw[key]))result[key]=raw[key] as number|null
  const strings=(v:unknown)=>Array.isArray(v)?v.filter((s):s is string=>typeof s==='string'):[]
  if(Array.isArray(raw.aliases))result.aliases=strings(raw.aliases)
  if(Array.isArray(raw.sizes))result.sizes=strings(raw.sizes).filter(s=>['Tiny','Small','Medium','Large','Huge','Gargantuan'].includes(s))
  if(Array.isArray(raw.unknown))result.unknown=strings(raw.unknown).filter(s=>['armor','hp','speed','cr','str','dex','con','int','wis','cha'].includes(s)) as NonNullable<MonsterExtensions['unknown']>
  const info=object(raw.sourceInfo),provenance=object(raw.provenance),text=(v:unknown)=>typeof v==='string'?v:''
  if(raw.sourceInfo)result.sourceInfo={id:text(info.id),edition:text(info.edition),page:text(info.page),url:text(info.url)}
  if(raw.provenance)result.provenance={format:text(provenance.format),original:text(provenance.original),notes:text(provenance.notes)}
  const token=readMonsterToken(raw.token)
  if(token)result.token=token
  else if(provenance.format==='5etools'&&typeof provenance.original==='string'){
    try{result.token=fiveToolsMonsterToken(object(JSON.parse(provenance.original)).monster)}catch{/* Unreadable optional provenance does not prevent rendering. */}
  }
  if(raw.info){const info=object(raw.info);result.info={text:text(info.text),source:text(info.source),images:Array.isArray(info.images)?info.images.map(object).map(i=>({url:text(i.url),title:text(i.title),credit:text(i.credit)})):[]}}
  if(Array.isArray(raw.armorAlternatives))result.armorAlternatives=raw.armorAlternatives.map(object).filter(a=>typeof a.note==='string'&&(a.value===null||typeof a.value==='number'&&Number.isFinite(a.value))).map(a=>({value:a.value as number|null,note:a.note as string}))
  return result
}

/** External references are opt-in links, never executable or relative URLs. */
export function monsterReferenceUrl(value:string):string|undefined {
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined}catch{return undefined}
}

/** Decode only recognized inline tags. Unknown tags remain visible for review.
 * References are plain text, never silently linked to another edition. */
export function monsterRuleText(value:string):string {
  let result=value
  for(let depth=0;depth<12;depth++){
    const next=result.replace(/\{@([a-zA-Z]+)(?:\s+([^{}]*))?\}/g,(original,tag:string,body:string='')=>{
      const [name='',source='',display='']=body.split('|')
      switch(tag.toLowerCase()){
        case 'spell':case 'creature':case 'item':case 'condition':case 'sense':case 'skill':case 'status':case 'action':case 'variantrule':case 'hazard':case 'disease':case 'race':case 'class':case 'background':case 'feat':case 'cult':case 'deity':case 'reward':case 'object':case 'deck':case 'language':return `${display||name}${source?` [${source}]`:''}`
        case 'filter':case 'link':return name
        case 'book':case 'adventure':case 'table':return name+(source?` [${source}]`:'')
        case 'quickref':return body.split('|')[4]||name
        case 'style':case 'footnote':return name
        case 'atkr':return name.split(',').map(part=>({m:'Melee',r:'Ranged',mw:'Melee Weapon',rw:'Ranged Weapon',ms:'Melee Spell',rs:'Ranged Spell'}[part.trim()]??part)).join(' or ')+' Attack Roll:'
        case 'actsav':case 'actsave':return name.toUpperCase()+' Saving Throw:'
        case 'actsavefail':return 'Failure:'
        case 'actsavesuccess':return 'Success:'
        case 'actsavesuccessorfail':return 'Success or Failure:'
        case 'actsavefailby':return 'Failure by '+name+' or More:'
        case 'acttrigger':return 'Trigger:'
        case 'actresponse':return 'Response:'
        case 'hityourspellattack':return 'your spell attack modifier'
        case 'dcyourspellsave':return 'your spell save DC'
        case 'hom':return 'Hit or Miss:'
        case 'skillcheck':return name+' '+(source?`(${source})`:'')
        case 'damage':case 'dice':case 'dc':case 'chance':case 'scaledice':case 'scaledamage':return display||name
        case 'hit':case 'initiative':return /^[+-]/.test(name)?name:`+${name}`
        case 'h':return 'Hit: '
        case 'recharge':return `Recharge ${name||'6'}${name&&name!=='6'?'–6':''}`
        case 'atk':return name.split(',').map(part=>({mw:'Melee Weapon',rw:'Ranged Weapon',ms:'Melee Spell',rs:'Ranged Spell'}[part.trim()]??part)).join(' or ')+' Attack:'
        case 'b':case 'bold':case 'i':case 'italic':case 'note':return body
        default:return original
      }
    })
    if(next===result)break
    result=next
  }
  return result
}
