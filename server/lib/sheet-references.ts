import type { Character } from '../../shared/character'
import { innateRaceSpells } from '../../shared/workshop-race'
import { featNames } from '../../src/lib/feat-references'
import { activeWorkshopEntries } from './workshop-schema'
import type { CharacterRuleLibrary } from './workshop-rules'
import { coreSpell, coreSpellNamed } from './srd-snapshot'
import { legacySrdSpellKey } from '../../src/lib/spell-reference'
import { characterUsesDefinition } from './compendium-character'

/** Only definitions used by this character cross the room's assignment boundary. */
export function sheetReferences(c:Character,library:CharacterRuleLibrary) {
  const wanted=new Set([c.meta.race,c.meta.subrace,c.meta.klass,c.meta.subclass,c.meta.background,...(c.meta.classLevels??[]).map(e=>e.name),...c.features.map(f=>f.name),...c.features.filter(f=>/^feats?$/i.test(f.name.trim())).flatMap(f=>featNames(f.description))].map(n=>n.trim().toLowerCase()))
  const spellIds=new Set([...c.spellcasting.known,...c.spellcasting.prepared,...innateRaceSpells(c).map(s=>s.index)])
  const compact=(entries:typeof library.catalog.spells)=>entries.map(({details,sourcePacks,sources,...entry})=>entry)
  const select=(kind:'classes'|'races'|'subclasses'|'backgrounds'|'feats')=>{
    const entries=library.catalog[kind].filter(e=>wanted.has(e.name.trim().toLowerCase()))
    return compact(kind==='classes'||kind==='races'||kind==='subclasses'?activeWorkshopEntries(entries,kind):entries)
  }
  const spells=library.catalog.spells.filter(s=>spellIds.has(s.index)||(s.aliases as string[]).some(a=>spellIds.has(a))||spellIds.has(s.contentKey))
  const custom=compact(spells).map(spell=>{
    const available=Array.isArray(spell.desc)&&spell.desc.some(line=>typeof line==='string'&&line.trim())
    const fallback=!available?coreSpellNamed(spell.name):undefined
    return fallback?{...fallback,sourcePack:'SRD 2014',aliases:[spell.index,...spell.aliases as string[]],referenceFallback:true,definitionAvailable:true}:{...spell,definitionAvailable:available}
  })
  const standard=[...spellIds].flatMap(id=>{
    if(spells.some(s=>s.index===id||s.contentKey===id||(s.aliases as string[]).includes(id)))return []
    const fallback=legacySrdSpellKey(id),spell=coreSpell(fallback??id)
    return spell?[{...spell,sourcePack:'SRD 2014',...(fallback?{aliases:[id],referenceFallback:true}:{})}]:[]
  })
  const result={spells:[...custom,...standard],feats:select('feats'),races:select('races'),subclasses:select('subclasses'),classes:select('classes'),backgrounds:select('backgrounds')}
  for(const definition of c.compendiumRules??[]){
    if(!(definition.kind in result))continue
    if(!characterUsesDefinition(c,{...definition,before:definition.entry},false))continue
    const rows=result[definition.kind as keyof typeof result] as Record<string,unknown>[]
    const exact=rows.findIndex(entry=>entry.index===definition.index||Array.isArray(entry.aliases)&&entry.aliases.includes(definition.index))
    const named=rows.filter(entry=>entry.name===definition.before.name)
    const i=exact>=0?exact:named.length===1?rows.indexOf(named[0]!):-1
    const {details,...entry}=definition.entry
    if(i>=0)rows[i]={...rows[i],...entry,definitionAvailable:true}
    else rows.push({...entry,definitionAvailable:true})
  }
  return result
}
