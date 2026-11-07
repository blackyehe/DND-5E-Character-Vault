import {contentLabel,type SrdRef} from './srd'
import {spellLevelGroups} from './spell-level-groups'
import {availableFacets,categoryFacetDefinitions,commonFacetDefinitions,compendiumFacets,matchesFacets,type FacetValues} from '../../shared/compendium-facets'

export interface WorkshopSpellChoice extends SrdRef {level?:number;filterFacets?:FacetValues}
export interface WorkshopSpellRecord {spell:WorkshopSpellChoice;name:string;source:string;level?:number;facts:FacetValues}
export type WorkshopSpellOrder='level'|'name'|'source'

export function workshopSpellRecords(spells:readonly WorkshopSpellChoice[]):WorkshopSpellRecord[]{
 return spells.map(spell=>{
  const facts=compendiumFacets(spell,'spells')
  if(!facts.level?.length&&typeof spell.level==='number'&&Number.isInteger(spell.level)&&spell.level>=0&&spell.level<=9)facts.level=[String(spell.level)]
  const level=facts.level?.[0]
  return {spell,name:contentLabel(spell),source:spell.sourcePack||'SRD 2014',level:level!==undefined&&/^[0-9]$/.test(level)?Number(level):undefined,facts}
 })
}
export const workshopSpellFields=(records:WorkshopSpellRecord[])=>availableFacets([...commonFacetDefinitions,...categoryFacetDefinitions('spells')],records.map(r=>r.facts))

export function queryWorkshopSpells(records:WorkshopSpellRecord[],query:string,facets:Record<string,string>,selected:readonly string[],selection:''|'selected'|'unselected',order:WorkshopSpellOrder){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),keys=new Set(selected)
 const matches=records.filter(record=>terms.every(term=>`${record.name} ${record.spell.name} ${record.source}`.toLocaleLowerCase().includes(term))&&matchesFacets(record.facts,facets)&&(!selection||keys.has(record.spell.index)===(selection==='selected')))
 if(order==='level')return spellLevelGroups(matches).flatMap(group=>group.spells)
 return matches.sort((a,b)=>(order==='source'?a.source.localeCompare(b.source):0)||a.name.localeCompare(b.name)||a.source.localeCompare(b.source)||a.spell.index.localeCompare(b.spell.index))
}
