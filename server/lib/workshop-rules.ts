import {validatedDraft} from './workshop-schema'
import {workshopFromEntry,type PublishedWorkshopRule,type WorkshopDraft} from '../../shared/homebrew-workshop'
import type {OrcbrewEntries} from './orcbrew'

/** Full definitions needed by character play. Never masquerades as a full pack library. */
export const CHARACTER_RULE_KINDS=['classes','subclasses','races','backgrounds','feats','spells'] as const
export type CharacterRuleKind=typeof CHARACTER_RULE_KINDS[number]
export type CharacterRuleCatalog=Pick<OrcbrewEntries,CharacterRuleKind>
export interface CharacterRuleLibrary {catalog:CharacterRuleCatalog;rules:PublishedWorkshopRule[];initial:Record<string,WorkshopDraft>;warnings:string[]}
/** Shared by the original full library and scoped reader. Ordering, race spell
 * disambiguation, lineage revisions and original baselines stay identical. */
export function characterRules(catalog:CharacterRuleCatalog){
  const rules:PublishedWorkshopRule[]=[],initial:Record<string,WorkshopDraft>={}
  for(const entry of [...catalog.classes,...catalog.subclasses,...catalog.races]){
    const raw=entry.details as Record<string,unknown>,draft=validatedDraft(raw[':codex/workshop'])
    if(!draft)continue
    const parent=catalog.classes.find(e=>e.index===draft.parentClass||e.contentKey===String(raw[':class']).replace(/^:/,''))
    const rule:PublishedWorkshopRule={id:draft.id,revision:Number(raw[':codex/revision'])||1,index:entry.index,previousIndexes:Array.isArray(raw[':codex/previous-indexes'])?raw[':codex/previous-indexes'] as string[]:[],previousNames:Array.isArray(raw[':codex/previous-names'])?raw[':codex/previous-names'] as string[]:[],parentClassName:parent?.name??String(raw[':class']??draft.parentClass).replace(/^:/,''),draft}
    const prior=rules.find(r=>r.id===rule.id)
    if(!prior||prior.revision<rule.revision){if(prior)rules.splice(rules.indexOf(prior),1);rules.push(rule);initial[rule.id]=validatedDraft(raw[':codex/baseline'])??draft}
  }
  // Imported races already carry readable traits and property grants. Resolve them
  // for existing sheets too, without requiring a first manual Workshop publication.
  for(const entry of catalog.races){
    if(rules.some(r=>r.draft.kind==='race'&&(r.index===entry.index||r.previousIndexes.includes(entry.index))))continue
    const draft=workshopFromEntry(entry,'race')
    for(const spell of draft.race?.spells??[]){const candidates=catalog.spells.filter(s=>s.contentKey===spell.index),sameSource=candidates.filter(s=>s.sourcePack===entry.sourcePack);const match=sameSource.length===1?sameSource[0]:candidates.length===1?candidates[0]:undefined;if(match){spell.index=match.index;spell.name=match.name}}
    rules.push({id:draft.id,revision:0,index:entry.index,previousIndexes:[],previousNames:[],draft})
    initial[draft.id]=draft
  }
  return {rules,initial}
}
