import { field, hasReadingValue, readingFields, readingLabel, readingName, record } from './compendium-reading'
import type { ReadingField } from './compendium-reading'

const plain = (key: string) => key.replace(/^:/,'').replace(/_/g,'-').replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase()
const without = (value: unknown, keys: string[]) => Object.fromEntries(Object.entries(record(value)).filter(([key])=>!keys.includes(plain(key))))
export interface ReadingBenefit { title: string; level?: unknown; value?: unknown; details: ReadingField[] }

/** Keep source order and unspecified levels. In particular, a spell's own level is not the level it is gained. */
export function readingBenefits(value: unknown, key = ''): ReadingBenefit[] | null {
  if(!['level-modifiers','level-selections'].includes(plain(key))||!Array.isArray(value)||!value.length)return null
  if(!value.every(row=>typeof field(row,'type')==='string'))return null
  return value.map(row=>{
    const type=String(field(row,'type')), payload=field(row,'value')
    const result:ReadingBenefit={title:readingLabel(type),level:field(row,'level'),value:payload,details:readingFields(without(row,['type','level','value']))}
    if(plain(type)==='spell'&&Object.keys(record(payload)).length){
      const name=readingName(payload)||field(payload,'key')
      const ability=field(payload,'ability')
      result.title=typeof name==='string'&&name ? `Spell: ${name.startsWith(':')?readingLabel(name):name}` : 'Spell'
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
