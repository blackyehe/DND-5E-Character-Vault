import { field, hasReadingValue, readingFields, readingLabel, readingName, readingText, record } from './compendium-reading'
import type { ReadingField } from './compendium-reading'

const plain = (key: string) => key.replace(/^:/,'').replace(/_/g,'-').replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase()
const without = (value: unknown, keys: string[]) => Object.fromEntries(Object.entries(record(value)).filter(([key])=>!keys.includes(plain(key))))
export interface ReadingBenefit { title: string; level?: unknown; value?: unknown; spell?:string; details: ReadingField[] }

/** Group only explicit acquisition levels. Preserve order within each level and retain unusual source values. */
export function readingBenefitGroups(benefits: ReadingBenefit[]) {
  const groups: {level:unknown;benefits:ReadingBenefit[]}[]=[]
  for(const benefit of benefits){
    const level=hasReadingValue(benefit.level)?benefit.level:undefined
    let group=groups.find(row=>Object.is(row.level,level))
    if(!group){group={level,benefits:[]};groups.push(group)}
    group.benefits.push(benefit)
  }
  return groups.sort((a,b)=>{
    if(a.level===undefined||b.level===undefined)return a.level===undefined?-1:1
    if(typeof a.level==='number'&&typeof b.level==='number')return a.level-b.level
    if(typeof a.level==='number'||typeof b.level==='number')return typeof a.level==='number'?-1:1
    return 0
  })
}

export interface ReadingResource { name:string; notes:string; fields:ReadingField[] }
/** Compact presentation for complete Workshop tracker definitions; unfamiliar shapes keep the generic reader. */
export function readingResources(value:unknown,key=''):ReadingResource[]|null {
  if(!['resources','resource-trackers'].includes(plain(key))||!Array.isArray(value)||!value.length)return null
  if(!value.every(row=>typeof field(row,'name')==='string'&&['fixed','level','ability','proficiency'].includes(String(field(row,'basis')))&&['base','multiplier','minimum'].every(k=>typeof field(row,k)==='number'&&Number.isInteger(field(row,k)))&&(field(row,'basis')!=='ability'||['str','dex','con','int','wis','cha'].includes(String(field(row,'ability')).replace(/^:/,'')))))return null
  return value.map(row=>{
    const basis=String(field(row,'basis')),base=Number(field(row,'base')),multiplier=Number(field(row,'multiplier')),minimum=Number(field(row,'minimum'))
    const ability=field(row,'ability'),basisLabel=basis==='level'?'Class level':basis==='ability'?`${typeof ability==='string'?readingLabel(ability):readingName(ability)||'Ability'} modifier`:'Proficiency bonus'
    const formula=basis==='fixed'?String(base):`${multiplier===1?'':`${multiplier} × `}${basisLabel}${base===0?'':base>0?` + ${base}`:` − ${Math.abs(base)}`}`
    const notes=typeof field(row,'notes')==='string'?readingText(field(row,'notes')):'',recovery=field(row,'recovery')
    const replaced=['name','basis','base','multiplier','minimum','ability',...(notes?['notes']:[]),'recovery']
    // The formula expresses the active basis. Inactive editor settings do not describe this resource's rules.
    return {name:String(field(row,'name')),notes,fields:[
      {label:'Maximum',value:`${formula} (minimum ${minimum})`},
      ...(hasReadingValue(field(row,'level'))?[{label:'Available at level',value:field(row,'level')}]:[]),
      ...(hasReadingValue(recovery)?[{label:'Recovery',value:recovery==='short'?'Short rest':recovery==='long'?'Long rest':recovery==='manual'?'Manual':recovery}]:[]),
      ...readingFields(without(row,[...replaced,'level'])).map(f=>plain(f.key??'')==='unlimited-at'?{...f,label:'Unlimited from level'}:f),
    ]}
  })
}

/** Keep source order and unspecified levels. In particular, a spell's own level is not the level it is gained. */
export function readingBenefits(value: unknown, key = ''): ReadingBenefit[] | null {
  if(!['benefits','level-modifiers','level-selections'].includes(plain(key))||!Array.isArray(value)||!value.length)return null
  if(!value.every(row=>typeof field(row,'type')==='string'))return null
  return value.map(row=>{
    const type=String(field(row,'type')), payload=field(row,'value')
    const result:ReadingBenefit={title:readingLabel(type),level:field(row,'level'),value:payload,details:readingFields(without(row,['type','level','value']))}
    if(plain(type)==='spell'&&Object.keys(record(payload)).length){
      const name=readingName(payload)||field(payload,'key')
      const ability=field(payload,'ability')
      result.title=typeof name==='string'&&name ? `Spell: ${name.startsWith(':')?readingLabel(name):name}` : 'Spell'
      if(typeof name==='string'&&name)result.spell=name.replace(/^:/,'').split('/').pop()!
      // The key is normally editor metadata; here it is the spell's only name.
      result.value=undefined
      result.details=[
        ...(hasReadingValue(field(payload,'level'))?[{label:'Spell level',value:field(payload,'level')}]:[]),
        ...(hasReadingValue(ability)?[{label:'Casting ability',value:typeof ability==='string'?readingLabel(ability):ability}]:[]),
        ...readingFields(without(payload,['name','index','key','level','ability'])),...result.details,
      ]
    }
    return result
  })
}

export interface ReadingProgression { heading: string; valueHeading: string; rows: {level: string;value:unknown}[] }
/** Numbered maps only mean levels in these known fields. Unrelated numeric maps retain the generic reader. */
export function readingProgression(value: unknown, key = ''): ReadingProgression | null {
  const context=plain(key)
  const spellList=['spell-list','warlock-spells','cleric-spells','wizard-spells','druid-spells','paladin-spells','ranger-spells'].includes(context)
  const gained=['spells-known','cantrips-known'].includes(context)
  const totals=['spells','cantrips'].includes(context)
  if(totals&&Array.isArray(value)&&value.length&&value.every(row=>typeof field(row,'level')==='number'&&typeof field(row,'total')==='number'&&Object.keys(record(row)).every(k=>['level','total'].includes(plain(k))))){
    return {heading:'Level',valueHeading:'Total known',rows:value.map(row=>({level:String(field(row,'level')),value:field(row,'total')}))}
  }
  const pairs=Object.entries(record(value))
  if((!spellList&&!gained)||!pairs.length||!pairs.every(([k])=>/^:?\d+$/.test(k)))return null
  return {heading:spellList?'Spell level':'Level',valueHeading:spellList?'Spells':'Gained',rows:pairs.map(([k,v])=>{
    // Some Orcbrew domain/patron spell lists store their two spell slots as {0: spell, 1: spell}.
    const slots=Object.entries(record(v))
    const indexedSpells=spellList&&slots.length>0&&slots.every(([index,spell])=>/^:?\d+$/.test(index)&&typeof spell==='string'&&spell.startsWith(':'))
    return {level:spellList&&Number(k.replace(/^:/,''))===0?'Cantrips':k.replace(/^:/,''),value:indexedSpells?slots.map(([,spell])=>spell):v}
  })}
}
