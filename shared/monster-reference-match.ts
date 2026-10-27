import { canonicalMonsterSource,monsterIdentity,normalizeMonsterName,type MonsterIdentityEntry } from './monster-identity'
import type { MonsterReference } from './five-tools-monster'

const sourceKey=(s:string)=>canonicalMonsterSource(s).toLowerCase().replace(/[^a-z0-9]/g,'')
// Reviewed naming aliases only; never collapse an unspecified choice of form/color.
const reviewedNames:Record<string,string>={
  'MM:succubus/incubus':'Succubus',
  'MM:half-ogre':'Half-Ogre (Ogrillon)',
  'MM:psychic gray ooze':'Gray Ooze (Psychic)',
  'VGM:mind flayer lich (illithilich)':'Illithilich',
  'GGR:flying kraul warrior':'Winged Kraul Warrior',
  'GGR:rakdos performer (blade juggler)':'Rakdos Performer, Blade Juggler',
  'GGR:rakdos performer (fire eater)':'Rakdos Performer, Fire Eater',
  'GGR:rakdos performer (high-wire acrobat)':'Rakdos Performer, High-Wire Acrobat',
}
export function createMonsterReferenceMatcher(references:MonsterReference[],sources:Record<string,string>){
  const sourceIds=new Map(Object.entries(sources).flatMap(([id,title])=>[[sourceKey(id),id],[sourceKey(title),id]] as [string,string][]))
  return (entry:MonsterIdentityEntry):{reference?:MonsterReference;mode:'rules-and-info'|'info-only';reason:string}=>{
    const raw=entry.details as Record<string,unknown>|undefined
    if(raw?.[':codex/monster'])return {mode:'info-only',reason:'Native authored creature: retained for manual review.'}
    const identity=monsterIdentity(entry),source=sourceKey(identity.source)==='srd2014'?'MM':sourceIds.get(sourceKey(identity.source))
    if(!source)return {mode:'info-only',reason:'Source is unavailable in the verified snapshot.'}
    const originalName=normalizeMonsterName(identity.originalName),name=normalizeMonsterName(reviewedNames[source+':'+originalName]??identity.originalName)
    const matching=references.filter(r=>r.source===source&&(normalizeMonsterName(r.name)===name||r.aliases.some(a=>normalizeMonsterName(a)===name)))
    if(matching.length===1)return {reference:matching[0],mode:'rules-and-info',reason:'Exact source and creature name / declared SRD alias.'}
    if(matching.length>1)return {mode:'info-only',reason:'Ambiguous source-qualified reference.'}
    // Explicitly reviewed form families can share lore/art, never combat rules.
    if(identity.name!==identity.originalName){const family=references.filter(r=>r.source===source&&normalizeMonsterName(r.name)===normalizeMonsterName(identity.name));if(family.length===1)return {reference:family[0],mode:'info-only',reason:'Reviewed form family: shared lore/art only; original form rules retained.'}}
    return {mode:'info-only',reason:'No exact creature/form match in this source.'}
  }
}
