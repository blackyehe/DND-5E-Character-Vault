import type { MonsterStatblock,MonsterSectionKind } from './monster-statblock'
import type { MonsterExtensions } from './monster-extensions'
import { monsterRuleText } from './monster-extensions'

export interface MonsterEnrichment {
  snapshot:string
  name:string
  source:string
  url:string
  mode:'rules-and-info'|'info-only'
  sections:MonsterStatblock['sections']
  extended:MonsterExtensions
}
const ruleKey=(s:string)=>monsterRuleText(s).toLowerCase().replace(/\([^)]*(?:recharge|day|rest)[^)]*\)/g,'').replace(/[^a-z0-9]/g,'')
/** Supplement the exact source version; never replace numbers or discard local rules. */
export function enrichMonsterStatblock(base:MonsterStatblock,extra?:MonsterEnrichment):MonsterStatblock {
  if(!extra)return base
  const sections=base.sections.map(s=>({...s,entries:[...s.entries]}))
  if(extra.mode==='rules-and-info')for(const source of extra.sections){
    const existing=sections.find(s=>s.kind===source.kind)
    if(!existing){sections.push({...source,entries:[...source.entries]});continue}
    if(source.description.length>existing.description.length)existing.description=source.description
    for(const rule of source.entries){const index=existing.entries.findIndex(r=>ruleKey(r.name)===ruleKey(rule.name));if(index<0)existing.entries.push(rule);else if(rule.description.length>existing.entries[index]!.description.length)existing.entries[index]=rule}
  }
  const order:MonsterSectionKind[]=['traits','actions','bonus-actions','reactions','legendary-actions','mythic-actions','lair-actions','regional-effects']
  sections.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind))
  const extended={...extra.extended,...base.extended}
  for(const key of ['habitat','treasure'] as const)if(!extended[key])extended[key]=extra.extended[key]
  const own=base.extended?.info,incoming=extra.extended.info
  if(incoming){const images=[...(own?.images??[])];for(const image of incoming.images)if(!images.some(i=>i.url===image.url))images.push(image);extended.info={text:own?.text||incoming.text,source:own?.source||incoming.source,images}}
  return {...base,extended,sections,enrichment:{name:extra.name,source:extra.source,url:extra.url,mode:extra.mode,snapshot:extra.snapshot}}
}
