import { readEdn, type EdnSpan } from './edn'
import { canonicalContent, inspectOrcbrew, type OrcbrewEntry } from './orcbrew'
import { workshopSection, workshopSlots, type WorkshopDraft } from '../../shared/homebrew-workshop'
import { raceFeatures } from '../../shared/workshop-race'

class Literal {readonly code:string;constructor(code:string){this.code=code}}
class Patch {readonly fields:Record<string,unknown>;constructor(fields:Record<string,unknown>){this.fields=fields}}
const remove=Symbol('remove')
const keyword=(key:string)=>new Literal(`:${key.replace(/^:/,'')}`)
const patch=(fields:Record<string,unknown>)=>new Patch(fields)
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const kebab=(s:string)=>s.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase().replace(/[’']/g,'').replace(/^all /,'').replace(/ weapons?$/,'').replace(/^(light|medium|heavy) armor$/,'$1').replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'')

/** Only values authored here are serialized. Untouched imported forms keep their original bytes. */
export function writeEdn(v:unknown):string {
  if(v instanceof Literal)return v.code
  if(v===null||v===undefined)return 'nil'
  if(typeof v==='string')return JSON.stringify(v)
  if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Rules must use finite numbers');return String(v)}
  if(typeof v==='boolean')return String(v)
  if(v instanceof Map)return `{${[...v].map(([k,value])=>`${writeEdn(k)} ${writeEdn(value)}`).join(' ')}}`
  if(Array.isArray(v))return `[${v.map(writeEdn).join(' ')}]`
  return `{${Object.entries(object(v)).filter(([,value])=>value!==undefined).map(([key,value])=>`${key.startsWith(':')?key:JSON.stringify(key)} ${writeEdn(value)}`).join(' ')}}`
}
function applyMap(source:string,value:unknown,update:Patch,spans:WeakMap<object,EdnSpan>):string {
  const record=object(value),span=spans.get(record)
  if(!span?.fields){const fields=Object.fromEntries(Object.entries(update.fields).filter(([,v])=>v!==remove).map(([k,v])=>[k,v instanceof Patch?new Literal(applyMap('',{},v,new WeakMap())):v]));return writeEdn(fields)}
  const edits:{start:number;end:number;text:string}[]=[],added:string[]=[]
  for(const [key,next]of Object.entries(update.fields)){
    const field=span.fields[key]
    if(next===remove){if(field)edits.push({start:field.keyStart,end:field.end,text:''});continue}
    const text=next instanceof Patch?applyMap(source,record[key],next,spans):writeEdn(next)
    if(field)edits.push({start:field.start,end:field.end,text})
    else added.push(`${key} ${text}`)
  }
  if(added.length)edits.push({start:span.end-1,end:span.end-1,text:`\n${added.join('\n')}\n`})
  let result=source.slice(span.start,span.end)
  for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start-span.start)+edit.text+result.slice(edit.end-span.start)
  return result
}
export function compactDraft(draft:WorkshopDraft):WorkshopDraft {
  const {imported:_,published:__,localId:___,...clean}=draft
  return clean
}
function indexedDraft(draft:WorkshopDraft):WorkshopDraft {
  let trait=0,selection=0
  return {...compactDraft(draft),attacks:draft.attacks.map(row=>({...row,originalLevel:row.level})),features:draft.features.map(f=>f.choice&&f.originalSelection!==undefined?{...f,originalIndex:undefined,originalSelection:selection++}:{...f,originalIndex:trait++,originalSelection:undefined})}
}
export function findEntryNodes(root:unknown,kind:WorkshopDraft['kind'],entry:OrcbrewEntry):object[] {
  const result:object[]=[],section=`:orcpub.dnd.e5/${workshopSection(kind)}`
  function visit(node:Record<string,unknown>,depth:number){
    if(depth>16)return
    for(const [key,value] of Object.entries(object(node[section])))if(key.replace(/^:/,'')===entry.contentKey&&canonicalContent(value)===canonicalContent(entry.details))result.push(object(value))
    for(const [key,value]of Object.entries(node))if(!key.startsWith(':')&&value&&typeof value==='object'&&!Array.isArray(value))visit(object(value),depth+1)
  }
  visit(object(root),0);return result
}
export function compileWorkshopEntry(draft:WorkshopDraft,source:string|undefined,origin:OrcbrewEntry|undefined,revision:number,previousIndexes:string[],previousNames:string[],spellReferences:Map<string,{key:string;level:number}>,parentKey:string,baseline?:WorkshopDraft) {
  const spans=new WeakMap<object,EdnSpan>(),root=source?readEdn(source,()=>{},spans):{}
  const node=origin?findEntryNodes(root,draft.kind,origin)[0]:undefined
  const original=object(node),rawTraits=list(original[':traits']),selections=list(original[':level-selections'])
  const native=object(original[':codex/workshop']),nativeFeatures=list(native.features).map(object)
  if(native.id===draft.id)draft={...draft,features:draft.features.map(f=>{const previous=nativeFeatures.find(v=>v.id===f.id);return {...f,originalIndex:typeof previous?.originalIndex==='number'?previous.originalIndex:undefined,originalSelection:typeof previous?.originalSelection==='number'?previous.originalSelection:undefined}})}
  const traitName=(value:unknown)=>String(object(value)[':name']??'')
  // Older preview drafts predate provenance fields. Recover only unambiguous matches.
  draft={...draft,features:draft.features.map(f=>{
    if(f.choice&&f.originalSelection===undefined){const matches=selections.map((v,i)=>({v,i})).filter(({v})=>String(object(v)[':type']??'').replace(/^:/,'').replace(/-/g,' ').toLowerCase()===f.name.toLowerCase()&&Number(object(v)[':level']??1)===f.level);if(matches.length===1)return {...f,originalSelection:matches[0].i}}
    if(f.originalIndex===undefined&&!f.choice){const matches=rawTraits.map((v,i)=>({v,i})).filter(({v})=>traitName(v)===f.name&&Number(object(v)[':level']??1)===f.level||String(object(v)[':description']??'')===f.description&&f.description.length>0);if(matches.length===1)return {...f,originalIndex:matches[0].i}}
    return f
  })}
  const encoded=(value:unknown,fields:Record<string,unknown>)=>new Literal(applyMap(source??'',value,patch(fields),spans))
  const traits=draft.features.filter(f=>!f.choice||f.originalSelection===undefined).map(f=>encoded(f.originalIndex===undefined?undefined:rawTraits[f.originalIndex],{
    ':name':f.name,':level':f.level,':description':f.choice?`${f.description}\nChoose ${f.choose}: ${f.options.join('; ')}`:f.description,
  }))
  const referenceTraits=draft.resources.map(r=>({':name':`${r.name} — resource pool`,':level':r.level,':description':`Maximum: ${r.basis==='fixed'?r.base:`${r.multiplier} × ${r.basis==='level'?'class level':r.basis==='ability'?`${r.ability.toUpperCase()} modifier`:'proficiency bonus'} + ${r.base}`}. Minimum ${r.minimum}.${r.unlimitedAt?` Unlimited from class level ${r.unlimitedAt}.`:''} Recovery: ${r.recovery==='manual'?'manual':`${r.recovery} rest`}. ${r.notes}`}))
  if(draft.magic.enabled)referenceTraits.push({':name':'Spellcasting rules',':level':draft.magic.startsAt,':description':`${draft.magic.ability.toUpperCase()} spellcasting. ${draft.magic.progression} slot progression. ${draft.magic.learning==='known'?'Known spell':draft.magic.learning==='book'?'Spellbook':'Prepared spell'} system. ${draft.magic.learning==='known'?'':`Prepared maximum: ${draft.magic.preparedLevel==='none'?'0':draft.magic.preparedLevel==='half'?'half class level (rounded down)':'class level'} + ${draft.magic.ability.toUpperCase()} modifier + ${draft.magic.preparedBase}, minimum 1.`}${draft.magic.progression==='pact'?' Pact slots recover on a short rest. '+Array.from({length:20},(_,i)=>{const slots=Object.entries(workshopSlots(draft,i+1)).filter(([,n])=>n>0).map(([key,n])=>`${n} level-${key.slice(1)} slots`).join(', ')||'no slots';return `Class level ${i+1}: ${slots}`}).join('; ')+'.':''}`})
  const levelSelections=draft.features.filter(f=>f.choice&&f.originalSelection!==undefined).map(f=>encoded(selections[f.originalSelection!],{':level':f.level,':num':f.choose}))
  if(draft.kind==='race')referenceTraits.push(...raceFeatures(draft).filter(f=>f.featureId?.startsWith('race:')).map(f=>({':name':f.name,':level':f.level??1,':description':f.description})))
  const rawModifiers=list(original[':level-modifiers'])
  const attackModifiers=draft.attacks.filter(r=>r.total!==1||r.level!==1).map(row=>encoded(rawModifiers.find(m=>object(m)[':type']===':num-attacks'&&Number(object(m)[':level']??1)===(row.originalLevel??row.level)),{':type':keyword('num-attacks'),':level':row.level,':value':row.total}))
  const training=draft.kind==='class'?(['armor','weapons','tools'] as const).flatMap(group=>draft[group].map(value=>{const type=group==='armor'?'armor-prof':group==='weapons'?'weapon-prof':'tool-prof';return encoded(rawModifiers.find(m=>object(m)[':type']===`:${type}`&&String(object(m)[':value']).replace(/^:/,'')===kebab(value)&&Number(object(m)[':level']??1)<=1),{':type':keyword(type),':value':keyword(kebab(value))})})):[]
  const modifiers=rawModifiers.flatMap((m,index)=>{
    if(object(m)[':type']===':num-attacks')return []
    if(draft.kind==='class'&&[':armor-prof',':weapon-prof',':tool-prof'].includes(String(object(m)[':type']))&&Number(object(m)[':level']??1)<=1)return []
    const span=spans.get(rawModifiers)?.items?.[index]??spans.get(object(m));return [span?new Literal(source!.slice(span.start,span.end)):m]
  })
  const schedule=(rows:{level:number;total:number}[])=>{let previous=0;return new Map([...rows].sort((a,b)=>a.level-b.level).map(r=>{const amount=r.total-previous;previous=r.total;return[r.level,amount]}))}
  const spellList=new Map<number,Literal[]>()
  for(const index of draft.magic.spellList){const ref=spellReferences.get(index);if(!ref)throw new Error(`Choose a definition for the unresolved spell reference “${index}” before publishing.`);const group=spellList.get(ref.level)??[];if(!group.some(k=>k.code===`:${ref.key}`))group.push(keyword(ref.key));spellList.set(ref.level,group)}
  const proficiency=(values:string[])=>Object.fromEntries(values.map(v=>[`:${kebab(v)}`,true]))
  const fields:Record<string,unknown>={
    ':key':keyword(workshopKey(draft)),':name':draft.name,':option-pack':draft.source,':help':draft.description,':disabled?':false,
    ':traits':[...traits,...referenceTraits],':level-selections':levelSelections,':level-modifiers':[...modifiers,...attackModifiers,...training],
    ':codex/workshop':indexedDraft(draft),':codex/revision':revision,':codex/previous-indexes':previousIndexes,':codex/previous-names':previousNames,
    ':codex/baseline':baseline?compactDraft(baseline):compactDraft(draft),
  }
  if(draft.kind==='class')Object.assign(fields,{
    ':hit-die':draft.hitDie,':subclass-level':draft.subclassLevel,':subclass-title':draft.subclassTitle,':ability-increase-levels':draft.asiLevels,
    ':props':patch({':armor-prof':patch({...Object.fromEntries(Object.keys(object(object(original[':props'])[':armor-prof'])).map(k=>[k,false])),...proficiency(draft.armor)}),':weapon-prof':patch({...Object.fromEntries(Object.keys(object(object(original[':props'])[':weapon-prof'])).map(k=>[k,false])),...proficiency(draft.weapons)})}),
    ':profs':patch({':save':Object.fromEntries(draft.savingThrows.map(k=>[`:orcpub.dnd.e5.character/${k}`,true])),':tool':patch({...Object.fromEntries(Object.keys(object(object(original[':profs'])[':tool'])).map(k=>[k,false])),...proficiency(draft.tools)}),':skill-options':patch({':choose':draft.skillCount,':options':proficiency(draft.skillOptions)}),':skill-expertise-options':patch({':choose':draft.expertiseCount,':options':proficiency(draft.skillOptions)})}),
  })
  else if(draft.kind==='subclass')fields[':class']=keyword(parentKey)
  if(draft.kind==='race'&&draft.race){
    const r=draft.race,rawSpells=list(original[':spells'])
    Object.assign(fields,{':speed':r.speed,':size':keyword(r.size),':darkvision':r.darkvision,':languages':r.languages,
      ':abilities':Object.fromEntries(Object.entries(r.abilityBonuses).map(([key,value])=>[`:orcpub.dnd.e5.character/${key}`,value])),
      ':props':patch({':armor-prof':proficiency(draft.armor),':weapon-prof':proficiency(draft.weapons),':skill-prof':proficiency(r.skills),':damage-resistance':proficiency(r.resistances),':damage-immunity':proficiency(r.immunities)}),
      ':profs':patch({':tool':proficiency(draft.tools)}),
      ':spells':r.spells.map(s=>{
        const previous=rawSpells.find(v=>String(object(object(v)[':value'])[':key']??'').replace(/^:/,'')===s.index)
        return encoded(previous,{':value':patch({':key':keyword(spellReferences.get(s.index)?.key??s.index),':ability':keyword(`orcpub.dnd.e5.character/${s.ability}`),...(spellReferences.has(s.index)?{':level':spellReferences.get(s.index)!.level}:{})})})
      }),
    })
  }else fields[':spellcasting']=draft.magic.enabled&&draft.magic.progression!=='pact'?patch({':ability':keyword(`orcpub.dnd.e5.character/${draft.magic.ability}`),':level-factor':draft.magic.progression==='half'?2:draft.magic.progression==='third'?3:1,':spellcasting-level':draft.magic.startsAt,':known-mode':keyword(draft.magic.learning==='known'?'schedule':'all'),':cantrips?':draft.magic.cantrips.length>0,':cantrips-known':schedule(draft.magic.cantrips),':spells-known':schedule(draft.magic.spells),':spell-list':spellList}):remove
  return {text:applyMap(source??'',node,patch(fields),spans),root,spans,nodes:origin?findEntryNodes(root,draft.kind,origin):[]}
}
export function placeWorkshopEntry(source:string|undefined,compiled:ReturnType<typeof compileWorkshopEntry>,kind:WorkshopDraft['kind'],key:string,replace:boolean):string {
  const section=`:orcpub.dnd.e5/${workshopSection(kind)}`
  if(!source)return `{${section} {${writeEdn(keyword(key))} ${compiled.text}}}\n`
  if(replace){
    let result=source
    for(const node of [...compiled.nodes].sort((a,b)=>compiled.spans.get(b)!.start-compiled.spans.get(a)!.start)){
      const span=compiled.spans.get(node)!;result=result.slice(0,span.start)+compiled.text+result.slice(span.end)
    }
    return result
  }
  const entries=inspectOrcbrew(source).entries[workshopSection(kind)]
  if(entries.some(e=>e.contentKey===key))throw new Error('This pack already contains an entry with this key. Open that entry to edit it, or save into a new pack.')
  const spans=new WeakMap<object,EdnSpan>(),root=readEdn(source,()=>{},spans)
  const span=spans.get(root as object)!
  return source.slice(0,span.start)+applyMap(source,root,patch({[section]:patch({[`:${key}`]:new Literal(compiled.text)})}),spans)+source.slice(span.end)
}
export const workshopKey=(draft:WorkshopDraft)=>draft.imported?.contentKey||`${slug(draft.name)||draft.kind}-${draft.id.slice(0,8)}`

/** Add/replace only our own monster definition; preserve unrelated EDN bytes. */
export function placeMonsterEntry(source:string|undefined,key:string,entry:Record<string,unknown>,nativeId:string):string {
  const section=':orcpub.dnd.e5/monsters',text=writeEdn(entry)
  if(!source)return `{${section} {${writeEdn(keyword(key))} ${text}}}\n`
  const spans=new WeakMap<object,EdnSpan>(),root=readEdn(source,()=>{},spans)
  const nodes:object[]=[]
  function visit(node:unknown,depth=0){if(depth>16)return;const record=object(node);for(const [name,value]of Object.entries(object(record[section])))if(name.replace(/^:/,'')===key){if(object(object(value)[':codex/monster']).id!==nativeId)throw new Error('This key belongs to another creature. Choose a different pack.');nodes.push(object(value))}for(const [name,value]of Object.entries(record))if(!name.startsWith(':')&&value&&typeof value==='object'&&!Array.isArray(value))visit(value,depth+1)}
  visit(root)
  if(nodes.length){let result=source;for(const node of nodes.sort((a,b)=>spans.get(b)!.start-spans.get(a)!.start)){const span=spans.get(node)!;result=result.slice(0,span.start)+text+result.slice(span.end)}return result}
  const span=spans.get(root as object);if(!span)throw new Error('The target pack must be an EDN map.')
  return source.slice(0,span.start)+applyMap(source,root,patch({[section]:patch({[`:${key}`]:new Literal(text)})}),spans)+source.slice(span.end)
}

export const monsterKeyword=keyword
