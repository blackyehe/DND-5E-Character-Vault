import type { Character } from '../../shared/character'
import { innateRaceSpells } from '../../shared/workshop-race'
import { featNames } from '../../src/lib/feat-references'
import { activeWorkshopEntries } from './workshop-schema'
import type { CharacterRuleLibrary } from './workshop-rules'
import { coreSpell, coreSpellNamed } from './srd-snapshot'
import { legacySrdSpellKey } from '../../src/lib/spell-reference'
import { characterUsesDefinition } from './compendium-character'
import {selectedOption} from '../../shared/option-reference'
import {isOptionKind,isFeatureOptionKind} from '../../shared/option-kinds'

/** Only definitions used by this character cross the room's assignment boundary. */
export function sheetReferences(c:Character,library:CharacterRuleLibrary) {
  const wanted=new Set([c.meta.race,c.meta.subrace,c.meta.klass,c.meta.subclass,c.meta.background,...(c.meta.classLevels??[]).flatMap(e=>[e.name,e.subclass??'']),...c.features.map(f=>f.name),...c.features.filter(f=>/^feats?$/i.test(f.name.trim())).flatMap(f=>featNames(f.description))].map(n=>n.trim().toLowerCase()))
  const selected=new Set([c.meta.classIndex,c.meta.subclassIndex,c.meta.raceIndex,...(c.meta.classLevels??[]).flatMap(e=>[e.index,e.subclassIndex])].filter((id):id is string=>!!id))
  const spellIds=new Set([...c.spellcasting.known,...c.spellcasting.prepared,...innateRaceSpells(c).map(s=>s.index)])
  const compact=(entries:typeof library.catalog.spells)=>entries.map(({details,sourcePacks,sources,...entry})=>entry)
  const select=(kind:'classes'|'races'|'subclasses'|'backgrounds'|'feats'|'invocations'|'boons'|'selections'|'languages'|'other'|'subraces')=>{
    if(kind==='backgrounds'){const entry=selectedOption(library.catalog.backgrounds,c.meta.backgroundIndex,c.meta.background);return compact(entry?[entry]:[])}
    if(kind==='subraces'){const e=selectedOption(library.catalog.subraces??[],c.meta.subraceIndex,c.meta.subrace);return compact(e?[e]:[])}
    if(kind==='languages')return compact(c.proficiencies.languages.flatMap(label=>{const e=selectedOption(library.catalog.languages??[],undefined,label);return e?[e]:[]}))
    if(isFeatureOptionKind(kind)){
      const entries=new Map<string,typeof library.catalog.feats[number]>()
      for(const feature of c.features){
        if(feature.definition&&feature.definition.kind!==kind)continue
        if(kind!=='feats'&&!feature.definition)continue
        const labels=/^feats?$/i.test(feature.name.trim())?featNames(feature.description):[feature.name]
        for(const label of labels){const entry=selectedOption(library.catalog[kind]??[],feature.definition?.index,label);if(entry)entries.set(entry.index,entry)}
      }
      return compact([...entries.values()])
    }
    const entries=library.catalog[kind].filter(e=>wanted.has(e.name.trim().toLowerCase())||selected.has(e.index)||(e.aliases as string[]??[]).some(id=>selected.has(id)))
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
  const result={spells:[...custom,...standard],feats:select('feats'),races:select('races'),subclasses:select('subclasses'),classes:select('classes'),backgrounds:select('backgrounds'),invocations:select('invocations'),boons:select('boons'),selections:select('selections'),languages:select('languages'),other:select('other'),subraces:select('subraces')}
  for(const definition of c.compendiumRules??[]){
    if(!(definition.kind in result))continue
    if(!characterUsesDefinition(c,{...definition,before:definition.entry},false))continue
    const rows=result[definition.kind as keyof typeof result] as Record<string,unknown>[]
    const spellAliases=definition.kind==='spells'?[...new Set([definition.index,...[definition.before,definition.entry].flatMap(e=>[e.index,e.contentKey,...(Array.isArray(e.aliases)?e.aliases:[])])].filter((id):id is string=>typeof id==='string'))]:undefined
    const exact=rows.findIndex(entry=>entry.index===definition.index||Array.isArray(entry.aliases)&&entry.aliases.includes(definition.index)||spellAliases?.some(id=>entry.index===id||entry.contentKey===id||Array.isArray(entry.aliases)&&entry.aliases.includes(id)))
    const named=rows.filter(entry=>entry.name===definition.before.name)
    const option=isOptionKind(definition.kind)
    const i=exact>=0?exact:!option&&named.length===1?rows.indexOf(named[0]!):-1
    const {details,...values}=definition.entry
    const entry=spellAliases?{...values,aliases:spellAliases}:values
    const sourceUnavailable=option&&library.catalog[definition.kind as keyof typeof library.catalog]!==undefined&&!(library.catalog[definition.kind as 'feats'|'backgrounds'|'invocations'|'boons'|'selections'|'languages'|'other'|'subraces']??[]).some(e=>e.index===definition.index||(e.aliases as string[]??[]).includes(definition.index)||e.optionId&&e.optionId===entry.optionId)
    if(i>=0)rows[i]={...rows[i],...entry,definitionAvailable:true,...(sourceUnavailable?{sourceUnavailable:true}:{})}
    else rows.push({...entry,definitionAvailable:true,...(sourceUnavailable?{sourceUnavailable:true}:{})})
  }
  return result
}

/** Selectable imported identities without raw pack trees or full rules.
 * Descriptive legacy imports remain descriptive; this does not publish rules. */
export function sheetRuleOptions(library:CharacterRuleLibrary){
  return (['classes','subclasses','races'] as const).flatMap(kind=>activeWorkshopEntries(library.catalog[kind],kind).map(entry=>({
    index:entry.index,name:entry.name,url:'',displayName:String(entry.displayName??`${entry.name}${entry.sourcePack?' · '+entry.sourcePack:''}`),
    ruleKind:({classes:'class',subclasses:'subclass',races:'race'} as const)[kind],workshop:entry.workshop,
  })))
}
