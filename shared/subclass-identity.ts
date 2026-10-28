/** Browse families only. Every source ID, rule and character selection stays intact. */
export interface SubclassIdentityEntry {
  index:string;name:string;displayName?:string;sourcePack?:string;source?:unknown;class?:unknown
  filterFacets?:{parentClass?:string[]};workshop?:unknown;details?:unknown
}
const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const text=(value:unknown)=>typeof value==='string'?value.trim():''
export const normalizeSubclassName=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim()
const ref=(value:unknown)=>text(value)||text(row(value).index)||text(row(value).name)
const parentVersions:Record<string,string>={
  'artificer-tashas_cauldron_of_everything':'artificer','artificer-ua-artificer':'artificer',
  'artificer-returned':'artificer','artificer-revisited':'artificer',
}
const parentVersionLabels:Record<string,string>={
  'artificer-tashas_cauldron_of_everything':'Tasha’s Artificer',
  'artificer-ua-artificer':'UA Artificer','artificer-returned':'UA Artificer Returns','artificer-revisited':'UA Artificer Revisited',
}
const sourceSuffix=/^(?:TCoE|TCE|XGtE|XGE|SCAG|VRGtR|PHB|DMG|UA|Tasha['’]s Cauldron of Everything|Xanathar['’]s Guide to Everything|Van Richten['’]s Guide to Ravenloft)$/i
const names:Record<string,Record<string,string>>={
  barbarian:{berserker:'Path of the Berserker'},bard:{lore:'College of Lore'},cleric:{life:'Life Domain'},
  druid:{land:'Circle of the Land','circle of spres':'Circle of Spores','circle of the stars':'Circle of Stars'},
  monk:{'open hand':'Way of the Open Hand'},paladin:{devotion:'Oath of Devotion'},
  sorcerer:{draconic:'Draconic Bloodline'},warlock:{fiend:'The Fiend'},
  wizard:{evocation:'School of Evocation','blade singing':'Bladesinging'},
}
export function subclassParent(entry:SubclassIdentityEntry){
  const raw=row(entry.details),workshop=row(entry.workshop)
  return ref(workshop.parentClass)||ref(entry.class)||ref(raw[':class'])||entry.filterFacets?.parentClass?.[0]||''
}
/** Pack parent keys need not equal the class's display name. */
export function subclassMatchesClass(entry:SubclassIdentityEntry,klass:{index?:string;name:string;contentKey?:string;aliases?:string[]}){
  const normalize=(value:string)=>normalizeSubclassName(value.replace(/^:/,'').replace(/^.*\//,'')).replace(/[\s_]+/g,'-')
  const parent=normalize(subclassParent(entry))
  return !!parent&&[klass.index,klass.name,klass.contentKey,...klass.aliases??[]].some(value=>!!value&&normalize(value)===parent)
}
export function subclassIdentity(entry:SubclassIdentityEntry){
  const raw=row(entry.details),parent=subclassParent(entry)
  const parentKey=normalizeSubclassName(parent.replace(/^:/,'').replace(/^.*\//,''))
  const classKey=parentVersions[parentKey]??parentKey
  let name=entry.name.trim()
  for(let depth=0;depth<3;depth++){
    const match=name.match(/^(.*?)\s*(?:\(([^()]+)\)|\s[-–—]\s(.+))$/)
    if(!match||!sourceSuffix.test((match[2]??match[3]??'').trim()))break
    name=match[1]!.trim()
  }
  const originalName=name
  let variant=''
  // Reviewed patron/option variants; arbitrary parenthetical text is preserved.
  if(classKey==='warlock'){
    const genie=name.match(/^the genie\s*(?:\((dao|djinni|efreeti|marid)\)|:\s*(dao|djinni|efreeti|marid))$/i)
    if(genie){variant=(genie[1]??genie[2])!.replace(/^./,c=>c.toUpperCase());name='The Genie'}
    else if(/^the noble genie$/i.test(name)){variant='Noble Genie';name='The Genie'}
  }
  if(classKey==='barbarian'){
    const giant=name.match(/^path of the giant\s*\((druidcraft|thaumaturgy)\)\)?$/i)
    if(giant){variant=giant[1]!.replace(/^./,c=>c.toUpperCase());name='Path of the Giant'}
  }
  name=names[classKey]?.[normalizeSubclassName(name)]??name
  const source=text(entry.sourcePack)||text(entry.source)||text(raw[':option-pack'])||'SRD 2014'
  const ua=/^(?:UA\b|UA[-_\d]|Unearthed Arcana\b)/i.test(source)
  // Missing class data cannot prove a shared family, so keep the row isolated.
  return {key:JSON.stringify([classKey||`unknown:${entry.index}`,normalizeSubclassName(name)]),name,originalName,variant,classKey,parent,source,ua}
}
export function subclassSearchText(entry:SubclassIdentityEntry){
  const identity=subclassIdentity(entry)
  return normalizeSubclassName([entry.name,entry.displayName,identity.name,identity.originalName,identity.variant,identity.classKey,identity.parent,identity.source].filter(Boolean).join(' '))
}
export interface SubclassBrowseGroup<T> {key:string;name:string;classKey:string;versions:T[]}
export function groupSubclassEntries<T extends SubclassIdentityEntry>(entries:T[]):SubclassBrowseGroup<T>[] {
  const groups=new Map<string,SubclassBrowseGroup<T>>()
  for(const entry of entries){
    const identity=subclassIdentity(entry)
    let group=groups.get(identity.key)
    if(!group){group={key:identity.key,name:identity.name,classKey:identity.classKey,versions:[]};groups.set(identity.key,group)}
    if(!group.versions.some(v=>v.index===entry.index))group.versions.push(entry)
  }
  for(const group of groups.values())group.versions.sort((a,b)=>{
    const left=subclassIdentity(a),right=subclassIdentity(b)
    return Number(left.ua)-Number(right.ua)||left.variant.localeCompare(right.variant)||left.source.localeCompare(right.source)||a.index.localeCompare(b.index)
  })
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.classKey.localeCompare(b.classKey)||a.key.localeCompare(b.key))
}
export function subclassVersionLabel(entry:SubclassIdentityEntry){
  const identity=subclassIdentity(entry)
  const parentVersion=parentVersionLabels[normalizeSubclassName(identity.parent.replace(/^:/,''))]??''
  return [identity.originalName,identity.source,parentVersion].filter(Boolean).join(' · ')
}
