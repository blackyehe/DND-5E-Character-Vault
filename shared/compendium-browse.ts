import type { EquipmentItem } from './character'
import { availableFacets, categoryFacetDefinitions, commonFacetDefinitions, compendiumFacets, matchesFacets, type AvailableFacet, type FacetValues } from './compendium-facets'
import { canonicalMonsterSource, groupMonsterEntries, monsterSearchText, normalizeMonsterName } from './monster-identity'
import { normalizeItemName } from './item-reference'
import { equipmentTags } from './item-classification'
// This module is pure data/filter logic, shared with the existing item picker.
import { hasMagicItemTags, itemSearchText, matchesEquipmentItem, matchesMagicItem, normalEquipmentSearch, type ItemSearchFilters } from '../src/lib/magic-item-filters'

export const COMPENDIUM_PAGE_SIZE = 25
export const BROWSE_KINDS = ['spells','equipment','magic-items','classes','subclasses','races','subraces','monsters','backgrounds','feats','invocations','boons','selections','languages','other'] as const
export type BrowseKind = typeof BROWSE_KINDS[number]
export interface BrowseEntry extends Record<string,unknown> {
  index:string; name:string; url:string; displayName?:string; sourcePack?:string; workshopItem?:EquipmentItem
  itemReference?:boolean; itemDamageTypes?:string[]; filterFacets?:FacetValues
}
export interface BrowseRecord { entry:BrowseEntry; search:string; facts:FacetValues }
export interface BrowseIndex { records:BrowseRecord[]; categoryFields:AvailableFacet[]; commonFields:AvailableFacet[]; extraTags:string[]; unclassifiedMagicItems:number }
export interface BrowseQuery { query:string; page:number; facets:Record<string,string>; items:ItemSearchFilters }
export interface BrowsePage {
  revision:string; entries:BrowseEntry[]; page:number; pageSize:number; pages:number
  total:number; matchedEntries:number; totalEntries:number
  categoryFields:AvailableFacet[]; commonFields:AvailableFacet[]; extraTags:string[]; unclassifiedMagicItems:number
}
export function browseRecord(entry:BrowseEntry,kind:BrowseKind):BrowseRecord {
  const facts=compendiumFacets(entry,kind)
  if(kind==='monsters')facts.source=[...new Set((facts.source??[]).map(canonicalMonsterSource))]
  const item=entry.workshopItem??(kind==='equipment'?normalEquipmentSearch[entry.index]:undefined)
  const search=kind==='monsters'?monsterSearchText(entry):item?itemSearchText(item):(entry.displayName??entry.name).toLowerCase()
  return {entry,search,facts}
}
export function browseIndex(records:BrowseRecord[],kind:BrowseKind):BrowseIndex {
  const facts=records.map(r=>r.facts)
  return {records,categoryFields:availableFacets(categoryFacetDefinitions(kind),facts),commonFields:availableFacets(commonFacetDefinitions,facts),
    extraTags:[...new Set(records.flatMap(r=>r.entry.workshopItem?equipmentTags(r.entry.workshopItem):[]))].sort(),
    unclassifiedMagicItems:kind==='magic-items'?records.filter(r=>!r.entry.workshopItem&&!hasMagicItemTags(r.entry.index)).length:0}
}
export function queryBrowseIndex(index:BrowseIndex,kind:BrowseKind,request:BrowseQuery,revision:string):BrowsePage {
  const term=kind==='monsters'?normalizeMonsterName(request.query):request.query.trim().toLowerCase()
  const entries=index.records.filter(({entry,search,facts})=>{
    if(term&&!search.includes(term)||!matchesFacets(facts,request.facets))return false
    if(kind!=='equipment'&&kind!=='magic-items')return true
    const item=entry.workshopItem??(kind==='equipment'?normalEquipmentSearch[entry.index]:undefined)
    if(item&&entry.itemReference&&request.items.damage&&entry.itemDamageTypes?.includes(request.items.damage))return matchesEquipmentItem(item,{...request.items,damage:''})
    return item?matchesEquipmentItem(item,request.items):kind==='magic-items'?matchesMagicItem(entry.index,request.items):!Object.values(request.items).some(Boolean)
  }).map(r=>r.entry)
  // Filter individual source versions first, then paginate whole families. A family
  // and its version selector must never be split between pages.
  let groups:BrowseEntry[][]
  if(kind==='monsters')groups=groupMonsterEntries(entries).map(g=>g.versions)
  else if(kind==='equipment'||kind==='magic-items'){
    const byName=new Map<string,BrowseEntry[]>()
    for(const entry of entries){const key=normalizeItemName(entry.name),rows=byName.get(key)??[];rows.push(entry);byName.set(key,rows)}
    groups=[...byName.values()].sort((a,b)=>a[0]!.name.localeCompare(b[0]!.name))
  }else groups=entries.sort((a,b)=>(a.displayName??a.name).localeCompare(b.displayName??b.name)||a.index.localeCompare(b.index)).map(e=>[e])
  const pages=Math.max(1,Math.ceil(groups.length/COMPENDIUM_PAGE_SIZE)),page=Math.max(1,Math.min(pages,Math.trunc(request.page)||1))
  return {revision,entries:groups.slice((page-1)*COMPENDIUM_PAGE_SIZE,page*COMPENDIUM_PAGE_SIZE).flat(),page,pageSize:COMPENDIUM_PAGE_SIZE,pages,
    total:groups.length,matchedEntries:entries.length,totalEntries:index.records.length,
    categoryFields:index.categoryFields,commonFields:index.commonFields,extraTags:index.extraTags,unclassifiedMagicItems:index.unclassifiedMagicItems}
}
