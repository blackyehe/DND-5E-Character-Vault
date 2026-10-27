/** Browse organization only: source definitions, IDs and character choices remain intact. */
export interface FamilyEntry {
  index:string;name:string;displayName?:string;sourcePack?:string;source?:unknown
  race?:unknown;type?:unknown;details?:unknown;workshop?:unknown
  filterFacets?:Record<string,string[]>
  familyContext?:{parent?:string;optionType?:string}
}
const row=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const ref=(v:unknown)=>text(v)||text(row(v).index)||text(row(v).name)
export const normalizeFamilyName=(value:string)=>value.normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim().toLowerCase()
const parentKey=(value:string)=>normalizeFamilyName(value.replace(/^:/,'').replace(/^.*\//,'')).replace(/[ _]+/g,'-')
// Only explicitly recognized source/edition markers are removed. A parenthetical
// such as a weapon form, quantity or unknown homebrew option stays significant.
const sourceSuffix=/^(?:TCoE|TCE|XGtE|XGE|SCAG|VRGtR|PHB|DMG|UA|AAG|MPMM|2024|Tasha['’]s Cauldron of Everything|Xanathar['’]s Guide to Everything)$/i
export function compendiumFamilyContext(entry:FamilyEntry,kind:string){
  const raw=row(entry.details)
  if(kind==='subraces')return {parent:entry.familyContext?.parent||ref(entry.race)||ref(raw[':race'])||entry.filterFacets?.parentRace?.[0]||''}
  if(kind==='selections'||kind==='other')return {optionType:entry.familyContext?.optionType||ref(entry.type)||ref(raw[':type'])||ref(raw[':option-type'])||entry.filterFacets?.optionType?.[0]||''}
  return {}
}
const raceParentAliases:Record<string,string>={
  'shifter-eberron-rising-from-the-last-war':'shifter',
  'half-elf-mark-of-detection-':'half-elf-mark-of-detection',
  'half-elf-mark-of-storm-':'half-elf-mark-of-storm',
  'half-orc-mark-of-finding-':'half-orc-mark-of-finding',
  ...Object.fromEntries(['handling','making','passage','sentinel'].map(mark=>[`human-mark-of-${mark}-`,`human-mark-of-${mark}`])),
}
export function compendiumFamilyIdentity(entry:FamilyEntry,kind:string){
  const raw=row(entry.details),context=compendiumFamilyContext(entry,kind)
  let name=entry.name.normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim()
  for(let depth=0;depth<3;depth++){
    const suffix=name.match(/^(.*?)\s*(?:\(([^()]+)\)|\s[-–—]\s(.+))$/)
    if(!suffix||!sourceSuffix.test((suffix[2]??suffix[3]??'').trim()))break
    name=suffix[1]!.trim()
  }
  if(kind==='spells')name=name.replace(/\s*\((?:Dunamancy|Izzet|Dimir Guild|Grave Domain)\)$/i,'').trim()
  if(kind==='classes'){
    if(/^artificer, (?:returned|revisited)$/i.test(name))name='Artificer'
    else if(/^(?:ranger \(revised\)|variant ranger \(all options\))$/i.test(name))name='Ranger'
    else if(/^(?:expert|spellcaster|warrior) sidekick \([^()]+saving throw prof\)$/i.test(name))name=name.slice(0,name.indexOf(' ('))
    else if(/^(?:sorcerer \(divine soul\)|sorcerer: favoured soul)$/i.test(name))name='Sorcerer'
    else if(/^wizard \(theurgy\)$/i.test(name))name='Wizard'
  }
  if(kind==='races'){
    name=name.replace(/^(Half-Elf|Half-Orc|Human), (Mark of .+)$/i,'$1 ($2)')
    if(/^symic hybrid$/i.test(name))name='Simic Hybrid'
    if(/^aasimar \(dmg variant\)$/i.test(name))name='Aasimar'
    if(/^orc \((?:eberron|wildemount)\)$/i.test(name))name='Orc'
    if(/^minotaur \(krynn\)$/i.test(name))name='Minotaur'
    if(/^dragonborn(?:, (?:chromatic|gem|metallic)| \(wildemount\))$/i.test(name))name='Dragonborn'
    if(/^tiefling \((?:fiendish|mtof|scag non-winged|scag winged|tobm) variant\)$/i.test(name))name='Tiefling'
  }
  if(kind==='subraces'){
    if(/^fallen aasimar$/i.test(name))name='Fallen'
    // Reviewed ability/ancestry choices, never arbitrary parentheses.
    name=name.replace(/^(Draconblood|Ravenite) \((?:Black|Blue|Brass|Bronze|Copper|Gold|Green|Red|Silver|White)\)$/i,'$1')
    name=name.replace(/^(Warforged|Changeling|Envoy) \((?:(?:CHA|CON|DEX|INT|STR|WIS)(?:\s*[,/+&]\s*|\s+and\s+)?)+\)$/i,'$1')
  }
  if(kind==='feats'||kind==='invocations'){
    // Requirements remain verbatim in the version label and source rules,
    // including legacy imports missing their closing parenthesis.
    name=name.replace(/\s*(?:\|\s*|\(\s*)(?:prerequisites?\s*:|requires?\b)\s*.*$/i,'').trim()
    if(kind==='feats'){
      name=name.replace(/^(Elemental Touched) \((?:Druidcraft|Thaumaturgy)\)$/i,'$1')
      name=name.replace(/^(Ritual Caster) \((?:INT|WIS) Based\)$/i,'$1')
      name=name.replace(/^(Strixhaven Initiate) \((?:Lorehold|Prismari|Quandrix|Silverquill|Witherbloom)\)$/i,'$1')
      name=name.replace(/^(Guile of the Cloud Giant) \((?:Deception|Persuasion)\)$/i,'$1')
    }
  }
  if(kind==='selections'){
    name=name.replace(/^(Arcane Mastery) \((?:6th|7th|8th|9th) level\)$/i,'$1')
    name=name.replace(/^(Alchemical Formula|Wondrous Invention) Lv (?:2|3|5|9|10|14|15|17|20)$/i,'$1')
  }
  if(kind==='languages')name=name.replace(/^Primordial \((Aquan|Auran|Ignan|Terran)\)$/i,'$1')
  const parent=parentKey(context.parent??''),scope=kind==='subraces'?((raceParentAliases[parent]??parent)||`unknown:${entry.index}`):normalizeFamilyName(context.optionType??'').replace(/^:/,'')
  const source=text(entry.sourcePack)||text(entry.source)||text(raw[':option-pack'])||'SRD 2014'
  return {key:JSON.stringify([kind,scope,normalizeFamilyName(name)]),name,scope,parent:context.parent??'',optionType:context.optionType??'',source,ua:/^(?:UA\b|UA[-_\d]|Unearthed Arcana\b)/i.test(source)}
}
export function compendiumFamilySearch(entry:FamilyEntry,kind:string){
  const identity=compendiumFamilyIdentity(entry,kind)
  return normalizeFamilyName([entry.name,entry.displayName,identity.name,identity.parent,identity.optionType,identity.source].filter(Boolean).join(' '))
}
export interface CompendiumFamily<T>{key:string;name:string;scope:string;versions:T[]}
export function groupCompendiumFamilies<T extends FamilyEntry>(entries:T[],kind:string):CompendiumFamily<T>[] {
  const groups=new Map<string,CompendiumFamily<T>>()
  for(const entry of entries){
    const id=compendiumFamilyIdentity(entry,kind)
    let group=groups.get(id.key)
    if(!group){group={key:id.key,name:id.name,scope:id.scope,versions:[]};groups.set(id.key,group)}
    if(!group.versions.some(v=>v.index===entry.index))group.versions.push(entry)
  }
  for(const group of groups.values()){
    group.versions.sort((a,b)=>{const x=compendiumFamilyIdentity(a,kind),y=compendiumFamilyIdentity(b,kind);return Number(x.ua)-Number(y.ua)||x.source.localeCompare(y.source)||a.name.localeCompare(b.name)||a.index.localeCompare(b.index)})
    // Prefer a readable mixed-case spelling to an all-caps import label.
    const readable=group.versions.map(e=>compendiumFamilyIdentity(e,kind).name).find(name=>name!==name.toUpperCase())
    if(readable)group.name=readable
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.scope.localeCompare(b.scope)||a.key.localeCompare(b.key))
}
export function compendiumVersionLabel(entry:FamilyEntry,kind:string){
  const id=compendiumFamilyIdentity(entry,kind)
  const readable=(value:string)=>value.replace(/^:/,'').replace(/^.*\//,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim()
  return [entry.name,id.source,readable(id.parent),readable(id.optionType)].filter(Boolean).join(' · ')
}
