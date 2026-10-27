import reviewedFamilies from './monster-families.json'

export interface MonsterIdentityEntry {
  index:string;name:string;displayName?:string;sourcePack?:string;source?:string;aliases?:string[];details?:unknown
}
export const normalizeMonsterName=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim()
const sourceKey=(s:string)=>normalizeMonsterName(s).replace(/[^a-z0-9]/g,'')
const sources:Record<string,string[]>={
  MM:['Monster Manual','MM 2014'],XMM:['Monster Manual 2025','Monster Manual 2024','MM 2025',"MM'25"],
  MTF:["Mordenkainen's Tome of Foes",'MToF'],MPMM:["Mordenkainen Presents: Monsters of the Multiverse",'Monsters of the Multiverse','MotM'],
  VGM:["Volo's Guide to Monsters",'VGtM'],TCE:["Tasha's Cauldron of Everything",'TCoE'],
  GGR:["Guildmasters' Guide to Ravnica",'GGtR'],ERLW:['Eberron - Rising from the Last War','Eberron: Rising from the Last War'],
  FTD:["Fizban's Treasury of Dragons",'FToD'],UA:['Unearthed Arcana'],
  'SRD 2014':['SRD 5.1','SRD2014'],'SRD 2024':['SRD 5.2','SRD 5.2.1'],
}
const sourceIds=new Map(Object.entries(sources).flatMap(([id,names])=>[id,...names].map(name=>[sourceKey(name),id] as const)))
export function canonicalMonsterSource(value:string){return sourceIds.get(sourceKey(value))??value.trim()}
const knownSource=(value:string)=>sourceIds.has(sourceKey(value))||/^UA\s*[-–:]\s*\S/i.test(value)
const corrections:Record<string,string>={Aarakroca:'Aarakocra',Nyacaloth:'Nycaloth',Pteradon:'Pteranodon','Storm Giant Quintessant':'Storm Giant Quintessent',Titivllus:'Titivilus','Duergar Soulblades':'Duergar Soulblade',Rothe:'Rothé','Deep Rothe':'Deep Rothé'}
const corrected=new Map(Object.entries(corrections).map(([name,canonical])=>[normalizeMonsterName(name),canonical]))
// Explicit allow-list from docs/audits/monster-name-review-2026-10-22.json,
// category "Forms / options". Reprint/replacement edges are deliberately excluded.
const families=new Map(Object.entries(reviewedFamilies).map(([name,family])=>[normalizeMonsterName(name),family]))
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
export function monsterIdentity(entry:MonsterIdentityEntry){
  const details=object(entry.details),native=object(details[':codex/monster']),extended=object(native.extended??details[':codex/extended']),sourceInfo=object(extended.sourceInfo)
  const text=(value:unknown)=>typeof value==='string'?value.trim():''
  let name=entry.name.trim(),suffix=''
  // Strip only an entire recognized source label. Ordinary roles/parentheses survive.
  for(let depth=0;depth<3;depth++){
    const match=name.match(/^(.*?)\s+(?:[-–—]\s*|\(\s*)([^()]+?)\)?$/)
    if(!match||!knownSource(match[2]!))break
    suffix=match[2]!;name=match[1]!.trim()
  }
  name=corrected.get(normalizeMonsterName(name))??name
  const family=text(extended.family)||families.get(normalizeMonsterName(name))||name
  const source=canonicalMonsterSource(text(sourceInfo.id)||suffix||String(details[':option-pack']??entry.sourcePack??entry.source??'SRD 2014'))
  const edition=text(sourceInfo.edition),aliases=Array.isArray(extended.aliases)?extended.aliases.filter((v):v is string=>typeof v==='string'):[]
  return {key:normalizeMonsterName(family),name:family,originalName:name,source,edition,variant:text(extended.variant),aliases,ua:/^UA(?:\b|[-_\d])/i.test(source)}
}
export function monsterSearchText(entry:MonsterIdentityEntry){const identity=monsterIdentity(entry);return normalizeMonsterName([entry.name,entry.displayName,entry.sourcePack,identity.name,identity.source,identity.edition,...identity.aliases,...(entry.aliases??[])].filter(Boolean).join(' '))}
export interface MonsterBrowseGroup<T> {key:string;name:string;versions:T[];choices:{entry:T;copies:T[]}[]}
function definitionKey(entry:MonsterIdentityEntry):string|null {
  const details=object(entry.details)
  // A sparse index cannot prove equivalence. Compare every retained raw field,
  // including unsupported fields and prose; only root identity labels are omitted.
  if(!Object.keys(details).length||details[':codex/monster'])return null
  const ignored=new Set([':name',':key',':option-pack',':disabled?',':edit-event'])
  const raw=Object.fromEntries(Object.entries(details).filter(([key])=>!ignored.has(key)))
  function stable(value:unknown):unknown {
    if(Array.isArray(value))return value.map(stable)
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]))
    return value
  }
  const m=monsterIdentity(entry)
  return JSON.stringify([normalizeMonsterName(m.originalName),m.source,m.edition,m.variant,stable(raw)])
}
/** Browsing only: retain every ID and every definition, including identical-looking ones. */
export function groupMonsterEntries<T extends MonsterIdentityEntry>(entries:T[]):MonsterBrowseGroup<T>[] {
  const groups=new Map<string,MonsterBrowseGroup<T>>()
  for(const entry of entries){const identity=monsterIdentity(entry);let group=groups.get(identity.key);if(!group){group={key:identity.key,name:identity.name,versions:[],choices:[]};groups.set(identity.key,group)}if(!group.versions.some(v=>v.index===entry.index))group.versions.push(entry)}
  for(const group of groups.values())group.versions.sort((a,b)=>{const left=monsterIdentity(a),right=monsterIdentity(b);return Number(left.ua)-Number(right.ua)||Number(normalizeMonsterName(left.originalName)!==group.key)-Number(normalizeMonsterName(right.originalName)!==group.key)||a.index.localeCompare(b.index)})
  for(const group of groups.values()){
    const identical=new Map<string,{entry:T;copies:T[]}>()
    for(const entry of group.versions){const key=definitionKey(entry),existing=key?identical.get(key):undefined;if(existing){existing.copies.push(entry);continue}const choice={entry,copies:[entry]};group.choices.push(choice);if(key)identical.set(key,choice)}
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name))
}
export function monsterVersionLabel(entry:MonsterIdentityEntry){const m=monsterIdentity(entry);return [m.originalName,m.variant,m.source,m.edition].filter(Boolean).join(' · ')}
