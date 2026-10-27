import { createHash } from 'node:crypto'
import { compendiumFacets } from '../../shared/compendium-facets'
import { canonicalContent, type OrcbrewEntry } from './orcbrew'
const cache=new WeakMap<OrcbrewEntry,ReturnType<typeof buildMonsterBrowseEntry>>()
export function monsterBrowseEntry(entry:OrcbrewEntry){let result=cache.get(entry);if(!result){result=buildMonsterBrowseEntry(entry);cache.set(entry,result)}return result}

/** Keep source identity and every search facet without shipping full rules/provenance. */
function buildMonsterBrowseEntry(entry:OrcbrewEntry) {
  const raw=entry.details as Record<string,unknown>,ext=(raw[':codex/extended']??{}) as Record<string,unknown>
  const identity=Object.fromEntries(['sourceInfo','aliases','family','variant'].filter(k=>ext[k]!==undefined).map(k=>[k,ext[k]]))
  const {':name':_,...definition}=raw
  return {index:entry.index,name:entry.name,displayName:entry.displayName,contentKey:entry.contentKey,source:entry.source,sourcePack:entry.sourcePack,sourcePacks:entry.sourcePacks,aliases:entry.aliases,homebrew:true,url:'',
    monsterDetailUrl:'/api/content/homebrew/monsters/'+encodeURIComponent(entry.index),filterFacets:compendiumFacets(entry,'monsters'),
    details:{':option-pack':raw[':option-pack'],':codex/extended':identity,':codex/browse-fingerprint':createHash('sha256').update(canonicalContent(definition)).digest('hex')}}
}
