import snapshotData from '../data/5etools-monster-references.json'
import tokenData from '../data/5etools-monster-tokens.json'
import type { MonsterToken } from '../../shared/monster-token'
import { CustomContent } from '../models/CustomContent'
import { createMonsterReferenceMatcher } from '../../shared/monster-reference-match'
import type { MonsterReference } from '../../shared/five-tools-monster'
import type { MonsterEnrichment } from '../../shared/monster-enrichment'
import type { MonsterIdentityEntry } from '../../shared/monster-identity'
import { sourceHash } from './orcbrew'

const snapshot=snapshotData as unknown as {snapshot:string;sources:Record<string,string>;references:MonsterReference[]}
const match=createMonsterReferenceMatcher(snapshot.references,snapshot.sources)
const tokens:Record<string,MonsterToken>=tokenData.tokens
function withToken(r:MonsterEnrichment):MonsterEnrichment {
  const token=r.extended.token??tokens[r.source+':'+r.name]
  return token?{...r,extended:{...r.extended,token}}:r
}
const supplement=(r:MonsterReference,mode:MonsterEnrichment['mode']):MonsterEnrichment=>withToken({snapshot:r.snapshot,name:r.name,source:r.source,url:r.url,mode,sections:mode==='rules-and-info'?r.sections:[],extended:r.extended})
export const monsterSnapshotId=snapshot.snapshot
export function monsterEnrichmentPlan(entries:MonsterIdentityEntry[]) {
  const supplements:Record<string,MonsterEnrichment>={},report=entries.map(entry=>{
    const result=match(entry),r=result.reference
    if(r)supplements[entry.index]=supplement(r,result.mode)
    return {index:entry.index,name:entry.name,source:entry.sourcePack??entry.source??'SRD 2014',reference:r?.key??null,mode:result.mode,reason:result.reason,lore:!!r?.extended.info?.text,art:r?.extended.info?.images.length??0}
  })
  return {snapshot:monsterSnapshotId,revision:sourceHash(JSON.stringify(entries.map(e=>e.index).sort())),supplements,report,summary:{total:report.length,matched:report.filter(r=>r.reference).length,rules:report.filter(r=>r.reference&&r.mode==='rules-and-info').length,infoOnly:report.filter(r=>r.reference&&r.mode==='info-only').length,lore:report.filter(r=>r.lore).length,art:report.filter(r=>r.art).length,unmatched:report.filter(r=>!r.reference).length}}
}
export async function enrichedMonsterEntries<T extends MonsterIdentityEntry>(userId:string|undefined,entries:T[]) {
  if(!entries.length)return entries
  // Detail views need one supplement, not the account's entire saved bestiary.
  // Keep legacy keys containing Mongo path syntax readable via the full field.
  const keys=[...new Set(entries.map(entry=>entry.index))]
  const fields=keys.every(key=>/^[a-z0-9_-]+$/i.test(key))?keys.map(key=>`data.entries.${key}`).join(' '):'data.entries'
  const doc=await CustomContent.findOne({userId,type:'monster-enrichment',sourceHash:'active'}).select(fields).lean()
  const saved=(doc?.data as {entries?:Record<string,MonsterEnrichment>}|undefined)?.entries??{}
  return entries.map(entry=>saved[entry.index]?{...entry,monsterEnrichment:withToken(saved[entry.index])}:entry)
}
export function enrichedStandardMonster(data:unknown,path:string):unknown {
  if(!/^monsters\/[^/?]+$/.test(path)||!data||typeof data!=='object')return data
  const entry=data as MonsterIdentityEntry,result=match({...entry,sourcePack:'SRD 2014'})
  return result.reference?{...entry,monsterEnrichment:supplement(result.reference,result.mode)}:entry
}
