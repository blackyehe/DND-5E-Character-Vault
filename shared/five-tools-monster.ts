import { monsterRuleText } from './monster-extensions'
import type { MonsterEnrichment } from './monster-enrichment'
import type { MonsterStatblock,MonsterSectionKind } from './monster-statblock'

type Data=Record<string,unknown>
const object=(v:unknown):Data=>v&&typeof v==='object'&&!Array.isArray(v)?v as Data:{}
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const string=(v:unknown)=>typeof v==='string'?v:typeof v==='number'?String(v):''
/** Retain nested lists, tables, captions and unknown fields as readable text.
 * Unsupported structures remain visible rather than vanishing during import. */
export function fiveToolsText(value:unknown,depth=0):string {
  if(depth>40)throw new Error('Monster reference nesting exceeds the supported depth.')
  const text=(v:unknown)=>fiveToolsText(v,depth+1)
  if(value===null||value===undefined)return ''
  if(typeof value!=='object')return monsterRuleText(string(value))
  if(Array.isArray(value))return value.map(text).filter(Boolean).join('\n\n')
  const o=object(value),kind=string(o.type)
  if(kind==='list')return array(o.items).map(v=>'• '+text(v)).join('\n')
  if(kind==='table')return [text(o.caption),array(o.colLabels).map(text).join(' | '),...array(o.rows).map(row=>array(object(row).row??row).map(text).join(' | ')),text(o.footnotes)].filter(Boolean).join('\n')
  if(kind==='image')return ''
  if(kind==='dice')return text(o.toRoll)
  const parts=[o.name?string(o.name)+'.':'',text(o.entries??o.entry??o.items),text(o.headerEntries),text(o.footerEntries)]
  const known=new Set(['type','name','entries','entry','items','headerEntries','footerEntries','style','source','page','data','by','from','id','caption','colStyles','colLabels','rows','footnotes'])
  for(const [key,v]of Object.entries(o))if(!known.has(key)&&!key.startsWith('_')&&v!==undefined)parts.push(`${key}: ${text(v)}`)
  if(o.by)parts.push('— '+string(o.by)+(o.from?', '+text(o.from):''))
  return parts.filter(Boolean).join('\n\n')
}

export interface FiveToolsRecord {monster:Data;legendaryGroup:Data|null;fluff:Data|null}
export interface MonsterReference extends MonsterEnrichment {
  key:string
  aliases:string[]
  family:string
  stats:{ac:number|null;hp:number|null;cr:string;scores:(number|null)[]}
}
export function fiveToolsSpellcasting(s:Data):string {
  const lines=[fiveToolsText(s.headerEntries)]
  if(s.ability)lines.push('Spellcasting ability: '+string(s.ability).toUpperCase()+'.')
  for(const [key,label]of [['constant','Constant'],['will','At will'],['ritual','Rituals']] as const)if(s[key])lines.push(label+': '+array(s[key]).map(v=>fiveToolsText(v)).join(', '))
  for(const [key,label]of [['daily','day'],['rest','rest'],['weekly','week'],['monthly','month'],['yearly','year'],['recharge','recharge'],['charges','charges']] as const)for(const [usage,spells]of Object.entries(object(s[key])))lines.push(`${usage.replace(/e$/,'')}/${label}${usage.endsWith('e')?' each':''}: ${array(spells).map(v=>fiveToolsText(v)).join(', ')}`)
  for(const [level,value]of Object.entries(object(s.spells))){const o=object(value);lines.push(`${level==='0'?'Cantrips (at will)':'Level '+level+(o.slots!==undefined?' ('+o.slots+' slots)':'')}${o.lower!==undefined?' (includes level '+o.lower+')':''}: ${array(o.spells).map(v=>fiveToolsText(v)).join(', ')}`)}
  const known=new Set(['name','type','ability','displayAs','headerEntries','footerEntries','constant','will','ritual','daily','rest','weekly','monthly','yearly','recharge','charges','spells','hidden','hiddenHeader','hiddenFooter'])
  for(const [k,v]of Object.entries(s))if(!known.has(k)&&!k.startsWith('_'))lines.push(k+': '+fiveToolsText(v))
  lines.push(fiveToolsText(s.footerEntries));return lines.filter(Boolean).join('\n\n')
}
export function convertFiveToolsRecord(record:FiveToolsRecord,snapshot:string,sourceName:string):MonsterReference {
  const m=record.monster,g=record.legendaryGroup??{},f=record.fluff??{},name=string(m.name),source=string(m.source)
  const sections:MonsterStatblock['sections']=[]
  const add=(kind:MonsterSectionKind,title:string,entries:unknown,description='')=>{
    const rules=array(entries).map(entry=>{const r=object(entry);return {name:monsterRuleText(string(r.name)||title),description:fiveToolsText(r.entries??entry),usage:''}}).filter(r=>r.description)
    if(rules.length||description)sections.push({kind,title,description,entries:rules})
  }
  add('traits','Traits',m.trait);add('actions','Actions',m.action);add('bonus-actions','Bonus Actions',m.bonus);add('reactions','Reactions',m.reaction,fiveToolsText(m.reactionHeader))
  const legendaryDescription=m.legendaryHeader?fiveToolsText(m.legendaryHeader):m.legendaryActions!==undefined?`Legendary actions: ${m.legendaryActions}${m.legendaryActionsLair?` (${m.legendaryActionsLair} in its lair)`:''}.`:''
  add('legendary-actions','Legendary Actions',m.legendary,legendaryDescription)
  add('mythic-actions','Mythic Actions',m.mythic,[fiveToolsText(m.mythicHeader),fiveToolsText(g.mythicEncounter)].filter(Boolean).join('\n\n'))
  for(const [kind,title,key]of [['lair-actions','Lair Actions','lairActions'],['regional-effects','Regional Effects','regionalEffects']] as const){const description=fiveToolsText(g[key]);if(description)sections.push({kind,title,description,entries:[]})}
  for(const spell of array(m.spellcasting)){const s=object(spell),kind=({action:'actions',bonus:'bonus-actions',reaction:'reactions',legendary:'legendary-actions'} as Record<string,MonsterSectionKind>)[string(s.displayAs)]??'traits';let section=sections.find(x=>x.kind===kind);if(!section){section={kind,title:kind==='traits'?'Traits':kind,description:'',entries:[]};sections.push(section)}section.entries.push({name:string(s.name)||'Spellcasting',description:fiveToolsSpellcasting(s),usage:''})}
  if(array(m.variant).length){let section=sections.find(s=>s.kind==='traits');if(!section){section={kind:'traits',title:'Traits',description:'',entries:[]};sections.push(section)}for(const v of array(m.variant))section.entries.push({name:string(object(v).name)||'Variant',description:fiveToolsText(object(v).entries??v),usage:''})}
  const images=array(f.images).map(value=>{const image=object(value),href=object(image.href);return {url:href.type==='internal'?'https://5e.tools/img/'+string(href.path):string(href.url),title:fiveToolsText(image.title)||name,credit:fiveToolsText(image.credit)}}).filter(i=>/^https?:\/\//.test(i.url))
  const url='https://5e.tools/bestiary.html#'+encodeURIComponent(name.toLowerCase())+'_'+encodeURIComponent(source.toLowerCase())
  const ac=array(m.ac)[0],armor=typeof ac==='number'?ac:object(ac).ac,hp=object(m.hp).average
  return {key:source+':'+name,name,source,url,snapshot,mode:'rules-and-info',sections,aliases:[...array(m.alias).map(string),...(typeof m.srd==='string'?[m.srd]:[])],family:string(m._versionBase_name),stats:{ac:typeof armor==='number'?armor:null,hp:typeof hp==='number'?hp:null,cr:string(object(m.cr).cr??m.cr),scores:['str','dex','con','int','wis','cha'].map(k=>typeof m[k]==='number'?m[k] as number:null)},extended:{sourceInfo:{id:source,edition:m.edition==='one'||source.startsWith('X')?'2024':'2014',page:string(m.page),url},habitat:array(m.environment).map(string).join(', '),treasure:array(m.treasure).map(string).join(', '),info:{text:fiveToolsText(f.entries),source:[sourceName,m.page?'page '+m.page:''].filter(Boolean).join(', '),images}}}
}
