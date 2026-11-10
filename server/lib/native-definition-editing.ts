import {applyEntryChanges,type CompendiumKind,type EntryData} from '../../shared/compendium-editing'
import {entryBenefits} from '../../shared/rule-benefits'
import {entryOptionDraft} from '../../shared/entry-builders'
import {entrySpellDraft} from '../../shared/spell-builder'
import type {OptionDraft} from '../../shared/option-workshop'
import type {SpellDraft} from '../../shared/spell-workshop'
import {normalizeBuilderEntry} from './entry-builder-schema'
import {buildOrcbrewCatalog,type OrcbrewEntry,type ParsedOrcbrew} from './orcbrew'
import {activeWorkshopEntries} from './workshop-schema'

export function optionEdition(draft:OptionDraft,entry:EntryData):OptionDraft{
 // Native metadata retains category-specific choices which older imports lack.
 return {...draft,body:{...draft.body,...entryOptionDraft({...entry,optionBuilder:entry.optionBuilder??draft.body}),name:String(entry.name??draft.body.name)},benefits:entryBenefits(entry)}
}
export function spellEdition(draft:SpellDraft,entry:EntryData):SpellDraft{
 return {...draft,body:entrySpellDraft({...entry,spellBuilder:entry.spellBuilder??undefined}),benefits:entryBenefits(entry)}
}
/** Keep unmodelled personal fields, while the controls just saved take precedence. */
export function nativeDesired(kind:CompendiumKind,source:EntryData,previous:EntryData|undefined,draft:OptionDraft|SpellDraft|undefined,origin?:EntryData):EntryData{
 const changes={...previous};for(const key of ['index','aliases','url','displayName','sourcePack','sourcePacks','sources','details','optionId','optionRevision','spellId','spellRevision','workshop','workshopRevision'])delete changes[key]
 if(!draft)for(const key of ['name','description','hit_die','homebrew_traits','traits','speed','size'])delete changes[key]
 const entry=applyEntryChanges(source,changes)
 if(!draft&&previous?.details&&origin?.details){
  const controlled=new Set([':key',':name',':option-pack',':help',':description',':disabled?',':traits',':level-selections',':level-modifiers',':hit-die',':subclass-level',':subclass-title',':ability-increase-levels',':props',':profs',':class',':speed',':size',':darkvision',':languages',':abilities',':spells',':spellcasting'])
  const extra=Object.fromEntries(Object.entries(previous.details as EntryData).filter(([key,value])=>!key.startsWith(':codex/')&&!controlled.has(key)&&JSON.stringify(value)!==JSON.stringify((origin.details as EntryData)[key])))
  if(Object.keys(extra).length)entry.details={...source.details as EntryData,...extra}
 }
 if(!draft)return entry
 return normalizeBuilderEntry({...entry,benefits:draft.benefits,...(draft.kind==='spells'?{spellBuilder:draft.body}:{optionBuilder:draft.body})},kind)
}
export function savedPackEntry(kind:CompendiumKind,parsed:ParsedOrcbrew,pack:{id:string;filename:string;includeDisabled?:boolean},index:string):OrcbrewEntry{
 const catalog=buildOrcbrewCatalog([{...pack,parsed}]),rows=['classes','subclasses','races'].includes(kind)?activeWorkshopEntries(catalog[kind] as OrcbrewEntry[],kind as 'classes'|'subclasses'|'races'):catalog[kind]
 const entry=rows.find(e=>e.index===index);if(!entry)throw Error('The saved definition could not be read as active content.')
 return entry
}
