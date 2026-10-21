import spellData from '../data/srd-2014-spells.json'
import equipmentData from '../data/srd-2014-equipment.json'
import magicItemData from '../data/srd-2014-magic-items.json'
import compendiumIndex from '../data/srd-2014-compendium-index.json'
import { compendiumFacets } from '../../shared/compendium-facets'

// Public 2014 rules are served locally, so sheet details never depend on a slow
// third-party request. Source revision and notices are in server/data/README.md.
interface Rule {index:string;name:string;url:string;[key:string]:unknown}
const spells=spellData as Rule[],equipment=equipmentData as Rule[],magicItems=magicItemData as Rule[]
const spellIndex=new Map(spells.map(s=>[s.index,s]))
const compendiumSpells=spells.map(entry=>({index:entry.index,name:entry.name,url:entry.url,filterFacets:compendiumFacets(entry,'spells')}))
export const coreSpell=(index:string)=>spellIndex.get(index)
export function coreSpellNamed(name:string) {
  const key=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'')
  const matches=spells.filter(s=>key(s.name)===key(name))
  return matches.length===1?matches[0]:undefined
}
export function localSrdRule(path:string):unknown|undefined {
  const url=new URL(path,'https://srd.local/'),parts=url.pathname.slice(1).split('/')
  if(parts[0]==='compendium'&&parts.length===2&&!url.search){
    const kind=parts[1]!,entries=kind==='spells'?compendiumSpells:Object.hasOwn(compendiumIndex,kind)?compendiumIndex[kind as keyof typeof compendiumIndex]:undefined
    return entries?{count:entries.length,results:entries}:null
  }
  const entries=parts[0]==='spells'?spells:parts[0]==='equipment'?equipment:parts[0]==='magic-items'?magicItems:undefined
  if(!entries)return undefined
  if(parts.length===2&&!url.search)return entries.find(e=>e.index===parts[1])??null
  if(parts.length!==1)return undefined
  if([...url.searchParams.keys()].some(key=>!['name',...(parts[0]==='spells'?['level','class']:[])].includes(key)))return undefined
  const name=url.searchParams.get('name')?.toLowerCase(),level=url.searchParams.get('level'),klass=url.searchParams.get('class')
  const filtered=entries.filter(entry=>(!name||entry.name.toLowerCase().includes(name))&&(!level||level.split(',').includes(String(entry.level)))&&(!klass||(entry.classes as {index:string}[]??[]).some(c=>c.index===klass)))
  return {count:filtered.length,results:filtered.map(({index,name,url,level})=>({index,name,url,...(level===undefined?{}:{level})}))}
}
