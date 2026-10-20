import { computed, inject, onMounted, onUnmounted, provide, ref, watch, type ComputedRef, type InjectionKey } from 'vue'
import type { Character, CharacterFeature, EquipmentItem, FeatureOrigin } from '../../shared/character'
import { classes, equipmentFrom } from '../lib/character-sheet'
import { srd, type HomebrewFeat, type SrdRef, type SrdSpell } from '../lib/srd'
import { api } from '../lib/api'
import { useCharactersStore } from '../stores/characters'
import { innateRaceSpells } from '../../shared/workshop-race'
import { legacySrdSpellKey } from '../lib/spell-reference'
import { useAuthStore } from '../stores/auth'
import { sheetReferenceCache, sheetReferenceCacheKey, sheetReferenceInputs, type SheetReferences } from '../lib/sheet-reference-cache'

function createLibrary(c:ComputedRef<Character>) {
  const store=useCharactersStore(),auth=useAuthStore()
  const customSpellCatalog=ref<SrdSpell[]>([]), spells=ref<Record<string,SrdSpell>>({}),items=ref<Record<string,EquipmentItem>>({})
  const metadata=ref<Record<string,{origin:FeatureOrigin;level?:number}>>({})
  const ruleCatalog=ref<SrdRef[]>([]),featCatalog=ref<HomebrewFeat[]>([]),equipmentCatalog=ref<SrdRef[]>([])
  const magicItemCatalog=ref<SrdRef[]>([])
  const spellOptions=ref<(SrdRef&{level?:number})[]>([]),loading=ref(false),warning=ref(''),editorLoading=ref(false)
  let generation=0,editorScope=''
  let referenceController:AbortController|undefined
  const lastReferenceMs=ref(0),referenceSource=ref<'network'|'cache'>('network')
  const cache=new Map<string,Promise<unknown>>()
  const scope=()=>`${auth.user?.id??''}:${store.roomContext?.roomId??'owner'}:${store.roomContext?.role??'owner'}:${Boolean(store.roomContext?.preview)}:${store.roomContext?.championFor??''}:${c.value?._id}:${store.libraryRevision}:${c.value?.homebrew?.bindings.map(b=>`${b.ruleId}:${b.revision}`).join('|')??''}`
  function cached<T>(key:string,load:()=>Promise<T>):Promise<T>{const id=`${scope()}:${key}`;if(!cache.has(id))cache.set(id,load().catch(error=>{cache.delete(id);throw error}));return cache.get(id) as Promise<T>}
  async function resolveSpell(index:string) {
    const custom=customSpellCatalog.value.find(s=>s.index===index||s.contentKey===index||s.aliases?.includes(index))
    if(custom){if(custom.definitionAvailable===false)throw new Error('Spell definition is unavailable');return custom}
    if(index.startsWith('homebrew-'))return cached(`spell:${index}`,()=>api.get<SrdSpell>(`/api/characters/${c.value._id}/spell-definition/${encodeURIComponent(index)}`))
    return cached(`spell:${index}`,()=>srd.spell(index))
  }
  async function loadEditorCatalogs() {
    if(!c.value||!store.canEditPermanent||editorScope===scope())return
    const currentScope=scope(),id=c.value._id
    editorLoading.value=true
    try {
      const [data,gear,core,magic]=await Promise.all([
        cached('editor-options',()=>api.get<{rules:SrdRef[];feats:HomebrewFeat[];spells:(SrdRef&{level?:number})[]}>(`/api/characters/${id}/editor-options`)),
        srd.equipment().catch(()=>[]),srd.spells().catch(()=>[]),srd.magicItems().catch(()=>[]),
      ])
      if(currentScope!==scope())return
      ruleCatalog.value=data.rules;featCatalog.value=data.feats;equipmentCatalog.value=gear;magicItemCatalog.value=magic;spellOptions.value=[...core,...data.spells];editorScope=currentScope
    }catch{warning.value='Editor reference options could not load. Saved character values remain available.'}
    finally{editorLoading.value=false}
  }
  const slug=(s:string)=>s.toLowerCase().replace(/\s*[·(].*$/,'').trim().replace(/[^a-z0-9]+/g,'-')
  async function load() {
    const run=++generation
    referenceController?.abort()
    let character=c.value
    if(!character){loading.value=false;return}
    referenceController=new AbortController()
    const expectedMutation=store.mutation,context=store.roomContext,expectedScope=`${context?.roomId??'owner'}:${context?.role??'owner'}:${Boolean(context?.preview)}${context?.championFor?`:${context.championFor}`:''}`,started=performance.now()
    loading.value=true;warning.value=''
    // Saved inventory and features remain usable before reference lookups finish.
    items.value=Object.fromEntries(character.equipment.map(i=>[i._id??i.name,i]))
    const wantedIds=new Set([...character.spellcasting.known,...character.spellcasting.prepared,...innateRaceSpells(character).map(s=>s.index)])
    spells.value=Object.fromEntries(Object.entries({...store.openingSpells,...spells.value}).filter(([id])=>wantedIds.has(id)))
    const failed:string[]=[],jobs:Promise<unknown>[]=[]
    const safe=async<T>(name:string,task:Promise<T>,fallback:T)=>task.catch(()=>{failed.push(name);return fallback})
    const path=store.sheetApiPath(character._id)+'/references'
    const cacheKey=sheetReferenceCacheKey({userId:auth.user?.id,path,role:context?.role??'owner',version:character.updatedAt,revision:store.libraryRevision,preview:context?.preview})
    const cacheEpoch=sheetReferenceCache.epoch
    const cachedReferences=cacheKey?sheetReferenceCache.read(cacheKey):undefined
    referenceSource.value=cachedReferences?'cache':'network'
    store.startReferenceTiming(character._id,referenceSource.value)
    const refs=cachedReferences??await safe('homebrew references',api.get<SheetReferences>(path,{timeoutMs:20000,signal:referenceController.signal}),{spells:[],feats:[],races:[],subclasses:[],classes:[],backgrounds:[]} as SheetReferences)
    if(run!==generation)return
    if(cacheKey&&!cachedReferences&&!failed.length)sheetReferenceCache.write(cacheKey,refs,cacheEpoch)
    lastReferenceMs.value=performance.now()-started
    if(refs.character&&store.acceptResolved(cachedReferences?{...refs.character,externalImport:character.externalImport}:refs.character,expectedMutation,expectedScope))character=c.value
    customSpellCatalog.value=refs.spells
    if(!editorScope)featCatalog.value=refs.feats
    const spellMap:Record<string,SrdSpell>={}
    for(const index of new Set([...character.spellcasting.known,...character.spellcasting.prepared,...innateRaceSpells(character).map(s=>s.index)])) {
      const custom=refs.spells.find(s=>s.index===index||s.contentKey===index||s.aliases?.includes(index))
      if(custom){spellMap[index]=custom;if(custom.definitionAvailable===false)failed.push(`spell ${index}`);continue}
      if(spells.value[index]){spellMap[index]=spells.value[index];continue}
      if(index.startsWith('homebrew-')){
        const fallback=legacySrdSpellKey(index)
        if(fallback)jobs.push(safe(`spell ${index}`,srd.spell(fallback),null).then(detail=>{if(detail&&run===generation)spells.value={...spells.value,[index]:{...detail,referenceFallback:true}}}))
        else failed.push(`spell ${index}`)
        continue
      }
      jobs.push(safe(`spell ${index}`,cached(`spell:${index}`,()=>srd.spell(index)),null).then(detail=>{if(detail&&run===generation)spells.value={...spells.value,[index]:detail}}))
    }
    spells.value={...Object.fromEntries(Object.entries(spells.value).filter(([id])=>character.spellcasting.known.includes(id)||character.spellcasting.prepared.includes(id)||innateRaceSpells(character).some(s=>s.index===id))),...spellMap}
    jobs.push((async()=>{
      const incomplete=character.equipment.filter(item=>!item.weapon&&!item.armor)
      if(!incomplete.length)return
      const gear=await safe('equipment catalog',srd.equipment(),[])
      await Promise.allSettled(incomplete.map(async item=>{
      const aliases:Record<string,string>={leather:'leather-armor',padded:'padded-armor','studded-leather':'studded-leather-armor',hide:'hide-armor','half-plate':'half-plate-armor',plate:'plate-armor',splint:'splint-armor'}
      const name=slug(item.name.replace(/\s*\+\d+.*$/,'')),index=item.index??aliases[name]??name
      if(!gear.some(entry=>entry.index===index))return
      await safe(`item ${item.name}`,cached(`item:${index}`,()=>srd.equipmentItem(index)),null).then(detail=>{
        if(!detail||run!==generation)return
        const hydrated=equipmentFrom(detail)
        items.value={...items.value,[item._id??item.name]:{...hydrated,...item,armor:item.armor??hydrated.armor,weapon:item.weapon??hydrated.weapon,category:item.category??detail.equipment_category.name,description:item.description??hydrated.description,magicBonus:item.magicBonus??Number(item.name.match(/\+(\d+)/)?.[1]??0)}}
      })
      }))
    })())
    const featureMap:Record<string,{origin:FeatureOrigin;level?:number}>={},ambiguous=new Set<string>()
    const record=(name:string,origin:FeatureOrigin,level?:number)=>{const key=name.trim().toLowerCase(),old=featureMap[key];if(old&&old.origin!==origin)ambiguous.add(key);else featureMap[key]={origin,level:old&&old.level!==level?undefined:level}}
    for(const entry of classes(character)) {
      const custom=refs.classes.find(k=>k.name===entry.name)
      if(custom)custom.homebrew_traits.forEach(f=>record(f.name,'class',f.level))
      else if(character.features.some(f=>!f.origin||f.origin==='other'))jobs.push(safe('class progression',cached(`levels:${entry.name}`,()=>srd.classLevels(slug(entry.name))),[]).then(levels=>{if(run!==generation)return;levels.filter(l=>l.level<=entry.level).forEach(l=>l.features.forEach(f=>record(f.name,'class',l.level)));metadata.value={...featureMap}}))
    }
    refs.races.filter(r=>r.name===character.meta.race).forEach(r=>r.homebrew_traits.forEach(f=>record(f.name,'racial',f.level??1)))
    refs.subclasses.forEach(s=>s.traits.forEach(f=>record(f.name,'subclass',f.level)))
    refs.backgrounds.forEach(b=>b.traits.forEach(f=>record(f.name,'background',1)))
    refs.feats.forEach(f=>record(f.name,'feat'))
    for(const key of ambiguous)delete featureMap[key]
    metadata.value=featureMap
    await Promise.allSettled(jobs)
    if(run!==generation)return
    lastReferenceMs.value=performance.now()-started
    const opening=store.recordReferenceTiming(character._id,failed.length>0)
    if(opening){lastReferenceMs.value=opening.ms;referenceSource.value=opening.source}
    warning.value=failed.length?'Some reference details could not refresh. Saved character details remain usable.':''
    loading.value=false
  }
  const features=computed<CharacterFeature[]>(()=>(c.value?.features??[]).map(f=>({...metadata.value[f.name.toLowerCase()],...f})))
  onMounted(load)
  onUnmounted(()=>{generation++;referenceController?.abort();cache.clear()})
  watch(()=>c.value?`${scope()}:${sheetReferenceInputs(c.value)}`:'',load)
  return {spells,resolveSpell,items,features,featCatalog,ruleCatalog,equipmentCatalog,magicItemCatalog,spellOptions,loadEditorCatalogs,editorLoading,loading,warning,lastReferenceMs,referenceSource,reload:async()=>{cache.clear();sheetReferenceCache.clear();editorScope='';await load()}}
}
 type Library=ReturnType<typeof createLibrary>
const key:InjectionKey<Library>=Symbol('sheet-library')
export function provideSheetLibrary(c:ComputedRef<Character>){const library=createLibrary(c);provide(key,library);return library}
export function useSheetLibrary(){const library=inject(key);if(!library)throw new Error('Character library is unavailable');return library}
