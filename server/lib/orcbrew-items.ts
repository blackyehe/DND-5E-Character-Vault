import { fiveToolsItemView,type FiveToolsItemRecord } from '../../shared/five-tools-item'
import type { OrcbrewEntry } from './orcbrew'

export function normalizeOrcbrewItem(key:string,value:unknown) {
  const raw=value as Record<string,unknown>,record=raw[':codex/item'] as FiveToolsItemRecord|undefined
  if(record?.item){const view=fiveToolsItemView(record);return {name:String(raw[':name']??record.item.name),url:'',itemReference:true,itemDamageTypes:view.damageTypes,workshopItem:view.filterItem,itemView:view}}
  return {name:String(raw[':name']??key.replace(/^:/,'')),url:'',description:String(raw[':description']??''),desc:[String(raw[':description']??'')],homebrew:true}
}
/** Keep provenance, descriptions and artwork off the initial list response. */
export function itemBrowseEntry(entry:OrcbrewEntry,kind:string) {
  const {index,name,url,sourcePack,sources,homebrew,itemReference,itemDamageTypes,workshopItem,filterFacets}=entry
  return {index,name,url,sourcePack,sources,homebrew,itemReference,itemDamageTypes,workshopItem,filterFacets,
    itemDetailUrl:`/api/content/homebrew/items/${kind}/${encodeURIComponent(index)}`}
}
