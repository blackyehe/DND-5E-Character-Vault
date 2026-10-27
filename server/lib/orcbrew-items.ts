import { fiveToolsItemView,type FiveToolsItemRecord } from '../../shared/five-tools-item'
import type { OrcbrewEntry } from './orcbrew'

export function normalizeOrcbrewItem(key:string,value:unknown) {
  const raw=value as Record<string,unknown>,record=raw[':codex/item'] as FiveToolsItemRecord|undefined
  if(record?.item){const view=fiveToolsItemView(record);return {name:String(raw[':name']??record.item.name),url:'',itemReference:true,itemDamageTypes:view.damageTypes,workshopItem:view.filterItem,itemView:view}}
  return {name:String(raw[':name']??key.replace(/^:/,'')),url:'',description:String(raw[':description']??''),desc:[String(raw[':description']??'')],homebrew:true}
}
/** Keep provenance, descriptions and artwork off the initial list response. */
export function itemBrowseEntry(entry:OrcbrewEntry,kind:string) {
  const {details:_,itemView:__,description:___,desc:____,...rest}=entry
  return {...rest,itemDetailUrl:`/api/content/homebrew/items/${kind}/${encodeURIComponent(entry.index)}`}
}
