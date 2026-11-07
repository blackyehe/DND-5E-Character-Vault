<script setup lang="ts">
import WorkshopLibraryTools from '../components/workshop/WorkshopLibraryTools.vue'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {useRoute} from 'vue-router'
const CompendiumEntryEditor=defineAsyncComponent(()=>import('../components/compendium/CompendiumEntryEditor.vue'))
import { applyEntryChanges, changedEntryFields, type CompendiumEditState, type CompendiumKind, type EntryData } from '../../shared/compendium-editing'
import { vMotionPanel } from '../directives/siteMotion'
import { contentLabel, srd, type SrdEquipment, type SrdMagicItem, type SrdRef, type SrdSpell, type SrdLevel } from '../lib/srd'
const OrcbrewPacks=defineAsyncComponent(()=>import('../components/OrcbrewPacks.vue'))
import { emptyItemFilters } from '../lib/magic-item-filters'
import type { EquipmentItem } from '../../shared/character'
import ItemFilters from '../components/items/ItemFilters.vue'
import ImportedItemDetails from '../components/items/ImportedItemDetails.vue'
import type { fiveToolsItemView } from '../../shared/five-tools-item'
import { normalizeItemName } from '../../shared/item-reference'
import ItemRules from '../components/sheet/ItemRules.vue'
import MonsterStatblock from '../components/monsters/MonsterStatblock.vue'
import ReferenceReader from '../components/compendium/ReferenceReader.vue'
import CompendiumFocusDialog from '../components/compendium/CompendiumFocusDialog.vue'
import CompendiumFilters from '../components/compendium/CompendiumFilters.vue'
import CompendiumCategories from '../components/compendium/CompendiumCategories.vue'
import { compendiumTabLabel as tabLabel, type CompendiumTab as Tab } from '../lib/compendium-navigation'
import { facetLabel } from '../../shared/compendium-facets'
import { groupMonsterEntries,monsterVersionLabel,monsterIdentity } from '../../shared/monster-identity'
import { groupSubclassEntries,subclassVersionLabel } from '../../shared/subclass-identity'
import { groupCompendiumFamilies,compendiumVersionLabel } from '../../shared/compendium-family'
import { monsterStatblock } from '../../shared/monster-statblock'
import '../components/sheet/sheet.css'
import '../components/sheet/sheet-details.css'
import '../components/compendium/compendium-layout.css'

import { useCompendiumBrowse } from '../composables/useCompendiumBrowse'
import { useAuthStore } from '../stores/auth'
import type { BrowseKind } from '../../shared/compendium-browse'
import {releaseLocalCompendium} from '../lib/local-compendium-client'
import {loadCompendiumDetail,preloadCompendiumDetails,onCompendiumDetailsReset} from '../lib/compendium-detail-cache'
import {CompendiumDetailPreloader} from '../lib/compendium-detail-preloader'
import {foregroundBusy,onForegroundWork} from '../lib/foreground-work'
type LibraryRef = SrdRef & {workshopItem?:EquipmentItem}
type Detail = LibraryRef & Record<string, unknown> & {itemView?:ReturnType<typeof fiveToolsItemView>}
defineProps<{embedded?:boolean}>()
const editing=ref<{kind:CompendiumKind;index:string}|null>(null)
const editions=ref(new Map<string,EntryData>())
function edition<T extends LibraryRef>(entry:T):T {
  const changes=editions.value.get(entry.index)
  if(!changes)return entry
  const result=applyEntryChanges(entry as unknown as EntryData,changes)
  delete result.filterFacets
  if(changes.name)result.displayName=String(changes.name)
  return result as unknown as T
}
function savedEdition(state:CompendiumEditState){
  editions.value.set(state.index,changedEntryFields(state.source,state.entry))
  const entry=edition(state.entry as Detail)
  selectedEntries.value=selectedEntries.value.map(row=>row.index===state.index?{...entry}:row)
  const page=pageInfo.value?.page??1
  browse.clear();void search(page,true,true)
  if(selectedDetailIndex.value===state.index)detail.value=entry
}
const tab = ref<Tab>('spells')
const query = ref('')
const auth=useAuthStore()
const browse=useCompendiumBrowse(()=>auth.user?.id)
const results=computed(()=>browse.response.value?.entries as LibraryRef[]??[])
const selectedEntries=ref<LibraryRef[]>([])
const resultPanel=ref<HTMLElement|null>(null)
const pageInfo=browse.response
const filters=ref(emptyItemFilters())
const categoryFilters=ref<Record<string,string>>({})
const categoryFields=computed(()=>pageInfo.value?.categoryFields??[])
const commonFields=computed(()=>pageInfo.value?.commonFields??[])
const extraTags=computed(()=>pageInfo.value?.extraTags??[])
const hasFilters=computed(()=>Object.values(categoryFilters.value).some(Boolean)||Object.values(filters.value).some(Boolean))
const visibleResults=results
const monsterGroups=computed(()=>tab.value==='monsters'?groupMonsterEntries(visibleResults.value):[])
const subclassGroups=computed(()=>tab.value==='subclasses'?groupSubclassEntries(visibleResults.value):[])
const selectedSubclassGroup=computed(()=>subclassGroups.value.find(g=>g.versions.some(v=>v.index===selectedDetailIndex.value))??(tab.value==='subclasses'?groupSubclassEntries(selectedEntries.value)[0]:undefined))
function subclassOptionLabel(entry:LibraryRef){
  const label=subclassVersionLabel(entry),siblings=selectedSubclassGroup.value?.versions.filter(v=>subclassVersionLabel(v)===label)??[]
  return siblings.length>1?`${label} · version ${siblings.findIndex(v=>v.index===entry.index)+1}`:label
}
const isItemTab=computed(()=>tab.value==='equipment'||tab.value==='magic-items')
const itemGroups=computed(()=>{
  const groups=new Map<string,LibraryRef[]>()
  if(!isItemTab.value)return []
  for(const entry of visibleResults.value){const name=normalizeItemName(entry.name);const rows=groups.get(name)??[];rows.push(entry);groups.set(name,rows)}
  return [...groups].map(([key,versions])=>({key,name:versions[0]!.name,versions})).sort((a,b)=>a.name.localeCompare(b.name))
})
const isFamilyTab=computed(()=>tab.value!=='homebrew'&&tab.value!=='monsters'&&tab.value!=='subclasses'&&!isItemTab.value)
const familyGroups=computed(()=>isFamilyTab.value?groupCompendiumFamilies(visibleResults.value,tab.value):[])
const selectedFamilyGroup=computed(()=>familyGroups.value.find(g=>g.versions.some(v=>v.index===selectedDetailIndex.value))??(isFamilyTab.value?groupCompendiumFamilies(selectedEntries.value,tab.value)[0]:undefined))
function familyOptionLabel(entry:LibraryRef){
  const label=compendiumVersionLabel(entry,tab.value),siblings=selectedFamilyGroup.value?.versions.filter(v=>compendiumVersionLabel(v,tab.value)===label)??[]
  return siblings.length>1?`${label} · version ${siblings.findIndex(v=>v.index===entry.index)+1}`:label
}
function itemOptionLabel(entry:LibraryRef){
  const label=`${entry.name} · ${facetLabel('source',entry.sourcePack??'SRD 2014')}`,siblings=selectedItemGroup.value?.versions.filter(v=>v.name===entry.name&&(v.sourcePack??'SRD 2014')===(entry.sourcePack??'SRD 2014'))??[]
  return siblings.length>1?`${label} · version ${siblings.findIndex(v=>v.index===entry.index)+1}`:label
}
const selectedItemGroup=computed(()=>itemGroups.value.find(g=>g.versions.some(v=>v.index===selectedDetailIndex.value))??(isItemTab.value&&selectedEntries.value.length?{versions:selectedEntries.value}:undefined))
function preferredItemIndex(entries:LibraryRef[]){return (entries.find(e=>e.index.startsWith('homebrew-')&&e.sourcePack==='DMG')??entries.find(e=>e.index.startsWith('homebrew-'))??entries[0])!.index}
const selectedMonsterGroup=computed(()=>monsterGroups.value.find(g=>g.versions.some(v=>v.index===selectedDetailIndex.value))??(tab.value==='monsters'?groupMonsterEntries(selectedEntries.value)[0]:undefined))
const selectedMonsterChoice=computed(()=>selectedMonsterGroup.value?.choices.find(c=>c.copies.some(v=>v.index===selectedDetailIndex.value))?.entry.index??selectedDetailIndex.value)
function selectMonsterVersion(event:Event){void openDetail((event.target as HTMLSelectElement).value)}
function preferredMonsterIndex(entries:LibraryRef[]){
  const imported=entries.filter(e=>e.contentKey?.startsWith('five-tools-')&&!monsterIdentity(e).ua)
  return (imported.find(e=>monsterIdentity(e).source==='MM')??imported.find(e=>monsterIdentity(e).source==='XMM')??imported[0]??entries[0])!.index
}
const route=useRoute()
const preloader=new CompendiumDetailPreloader({preload:(owner,kind,indexes,signal,budget)=>{
 const run=()=>signal.aborted?Promise.resolve(0):preloadCompendiumDetails(owner,kind,indexes,signal,budget)
 // Share the existing idle-work lock with device-index preparation across tabs.
 return navigator.locks?navigator.locks.request(`codex-compendium:${owner}`,{ifAvailable:true},lock=>lock?run():undefined):run()
}})
function pausePreloading(){preloader.pause(document.hidden||!navigator.onLine||foregroundBusy()||route.path.startsWith('/rooms/')||!!editing.value)}
const stopForeground=onForegroundWork(pausePreloading),stopDetailReset=onCompendiumDetailsReset(()=>preloader.clear())
function visibleDetailIndexes(){
 if(tab.value==='monsters')return monsterGroups.value.map(g=>preferredMonsterIndex(g.versions))
 if(tab.value==='subclasses')return subclassGroups.value.map(g=>g.versions[0]!.index)
 if(isItemTab.value)return itemGroups.value.map(g=>preferredItemIndex(g.versions))
 if(isFamilyTab.value)return familyGroups.value.map(g=>g.versions[0]!.index)
 return results.value.map(e=>e.index)
}
watch([()=>route.path,()=>!!editing.value],pausePreloading)
onMounted(()=>{pausePreloading();document.addEventListener('visibilitychange',pausePreloading);window.addEventListener('online',pausePreloading);window.addEventListener('offline',pausePreloading)})
function clearFilters(){categoryFilters.value={};filters.value=emptyItemFilters()}
const unclassifiedMagicItems=computed(()=>pageInfo.value?.unclassifiedMagicItems??0)
const loading=browse.loading
const error=browse.error
const detail = ref<Detail | null>(null)
const selectedDetailIndex=ref('')
const detailPanel = ref<HTMLElement | null>(null)
const focused=ref(false),focusDialog=ref<InstanceType<typeof CompendiumFocusDialog>|null>(null)
let focusOpener:HTMLElement|null=null,previousDetailScroll=0
async function openFocus(){if(!detail.value||detailLoading.value)return;focusOpener=document.activeElement as HTMLElement|null;previousDetailScroll=detailPanel.value?.scrollTop??0;focused.value=true;await nextTick();detailPanel.value?.scrollTo({top:0,behavior:'instant'})}
async function closeFocus(){if(!focused.value)return;focused.value=false;await nextTick();detailPanel.value?.scrollTo({top:previousDetailScroll,behavior:'instant'});if(focusOpener?.isConnected)focusOpener.focus({preventScroll:true})}
async function editEntry(){const entry=detail.value;if(!entry||tab.value==='homebrew')return;await closeFocus();editing.value={kind:tab.value as CompendiumKind,index:entry.index}}
watch(() => detail.value?.index, async () => {
  await nextTick()
  detailPanel.value?.scrollTo({ top:0 })
})
const detailLoading = ref(false)
const detailError=ref('')
const levels=ref<SrdLevel[]>([]),levelsLoading=ref(false),levelsError=ref('')
const spellDetail = computed(() => detail.value as unknown as SrdSpell | null)
const monsterDetail = computed(() => {const m=monsterStatblock(detail.value);return detail.value?{...m,name:monsterIdentity(detail.value).originalName}:m})
const itemDetail = computed(() => detail.value as unknown as (SrdEquipment & SrdMagicItem) | null)
const itemStats = computed(() => {
  const item = itemDetail.value
  if (!item) return []
  const values: [string, string][] = []
  const add = (label: string, value: string | undefined) => { if (value) values.push([label, value]) }
  add('Category', [item.weapon_category, item.weapon_range, item.armor_category, item.equipment_category?.name].filter(Boolean).join(' · '))
  add('Rarity', item.rarity?.name)
  add('Cost', item.cost ? `${item.cost.quantity} ${item.cost.unit}` : undefined)
  add('Weight', item.weight !== undefined ? `${item.weight} lb` : undefined)
  add('Damage', item.damage ? `${item.damage.damage_dice} ${item.damage.damage_type.name}` : undefined)
  add('Two-handed damage', item.two_handed_damage ? `${item.two_handed_damage.damage_dice} ${item.two_handed_damage.damage_type.name}` : undefined)
  if (item.armor_class) {
    const ac = item.armor_class
    add('Armour class', `${item.index === 'shield' ? '+' : ''}${ac.base}${ac.dex_bonus ? ` + DEX modifier${ac.max_bonus !== undefined ? ` (maximum +${ac.max_bonus})` : ''}` : ''}`)
  }
  add('Strength required', item.str_minimum ? String(item.str_minimum) : undefined)
  add('Stealth', item.stealth_disadvantage ? 'Disadvantage' : undefined)
  const range = item.throw_range ?? item.range
  add(item.throw_range ? 'Thrown range' : 'Range', range ? `${range.normal}${range.long ? ` / ${range.long}` : ''} ft` : undefined)
  add('Properties', item.properties?.map(p => p.name).join(', '))
  add('Speed', item.speed ? `${item.speed.quantity} ${item.speed.unit}` : undefined)
  add('Capacity', item.capacity)
  return values
})
let detailNumber = 0
let searchTimer:ReturnType<typeof setTimeout>|undefined
let detailRevision=''
let searchNumber=0
function clearSelection(){
  focused.value=false
  ++detailNumber;selectedDetailIndex.value='';selectedEntries.value=[];detail.value=null;detailLoading.value=false;detailError.value=''
  levels.value=[];levelsLoading.value=false;levelsError.value=''
}
async function search(page=1,force=false,preserveSelection=false) {
  preloader.clear()
  clearTimeout(searchTimer)
  if(tab.value==='homebrew')return
  const kind=tab.value
  const sequence=++searchNumber
  const accepted=await browse.load(kind as BrowseKind,{query:query.value,page,facets:{...categoryFilters.value},items:{...filters.value}},force)
  if(!accepted||tab.value!==kind||sequence!==searchNumber)return
  const revision=pageInfo.value?.revision
  if(revision&&revision!==detailRevision){editions.value.clear();if(detailRevision&&!preserveSelection)clearSelection();detailRevision=revision}
  if(auth.user)preloader.setPage(auth.user.id,kind as BrowseKind,visibleDetailIndexes())
  await nextTick();resultPanel.value?.scrollTo({top:0})
}
watch(()=>JSON.stringify([tab.value,query.value,categoryFilters.value,filters.value]),(value,previous)=>{
  const [kind,term]=JSON.parse(value),[oldKind,oldTerm]=JSON.parse(previous)
  ++searchNumber;clearTimeout(searchTimer);browse.cancel();clearSelection()
  preloader.clear()
  if(kind!==oldKind){clearFilters();editions.value.clear();detailRevision='';browse.response.value=null;if(oldKind==='homebrew')browse.clear()}
  if(kind==='homebrew')return
  loading.value=true
  searchTimer=setTimeout(()=>void search(),term!==oldTerm?250:0)
})
watch(()=>auth.user?.id,()=>{preloader.clear();++searchNumber;clearTimeout(searchTimer);browse.clear();editions.value.clear();clearSelection();editing.value=null;if(auth.user)void search()})
onBeforeUnmount(()=>{preloader.dispose();stopForeground();stopDetailReset();document.removeEventListener('visibilitychange',pausePreloading);window.removeEventListener('online',pausePreloading);window.removeEventListener('offline',pausePreloading);releaseLocalCompendium();++searchNumber;clearTimeout(searchTimer);browse.cancel();++detailNumber})

async function openDetail(index:string) {
  const sequence=++detailNumber,kind=tab.value
  const group=kind==='monsters'?monsterGroups.value.find(g=>g.versions.some(v=>v.index===index)):kind==='subclasses'?subclassGroups.value.find(g=>g.versions.some(v=>v.index===index)):isItemTab.value?itemGroups.value.find(g=>g.versions.some(v=>v.index===index)):familyGroups.value.find(g=>g.versions.some(v=>v.index===index))
  if(group)selectedEntries.value=group.versions
  else if(!selectedEntries.value.some(e=>e.index===index))selectedEntries.value=results.value.filter(e=>e.index===index)
  selectedDetailIndex.value=index
  levels.value=[];levelsLoading.value=false;levelsError.value='';detailError.value='';detailLoading.value=false
  detail.value=null;detailLoading.value=true
  try{
    if(!auth.user||kind==='homebrew')return
    const entry=await loadCompendiumDetail(auth.user.id,kind,index) as Detail
    if(sequence!==detailNumber)return
    detail.value=edition(entry);void loadLevels(index,kind,sequence)
  }catch{if(sequence===detailNumber)detailError.value='Could not load this entry. Select it again to retry.'}
  finally{if(sequence===detailNumber)detailLoading.value=false}
}
async function loadLevels(index:string,kind:Tab,sequence=detailNumber){
  if((kind!=='classes'&&kind!=='subclasses')||index.startsWith('homebrew-'))return
  levelsLoading.value=true;levelsError.value=''
  try{const values=await (kind==='classes'?srd.classLevels(index):srd.subclassLevels(index));if(sequence===detailNumber&&detail.value?.index===index)levels.value=values}
  catch{if(sequence===detailNumber)levelsError.value='Features by level could not be loaded. The core entry is still available.'}
  finally{if(sequence===detailNumber)levelsLoading.value=false}
}

search()
</script>

<template>
  <div class="compendium-page" :class="embedded?'hw-compendium-embedded':'max-w-5xl mx-auto px-6 py-8'">
    <WorkshopLibraryTools v-if="embedded" title="All Compendium entries" description="Choose a source entry to edit. Review existing characters before applying changed rules to their sheets."><template #search><label v-if="tab!=='homebrew'" class="compendium-search"><span>Search {{tabLabel(tab).toLowerCase()}}</span><input v-model="query" type="search" :placeholder="`Search ${tabLabel(tab).toLowerCase()}…`" /></label><span v-else class="hw-hint">Manage imported files below.</span></template><template #filters><CompendiumCategories v-model="tab" /></template></WorkshopLibraryTools>
    <template v-else><h1 class="font-display text-3xl text-[var(--color-gold-soft)] mb-6">Compendium</h1><CompendiumCategories v-model="tab" /><label v-if="tab !== 'homebrew'" class="compendium-search"><span>Search {{tabLabel(tab).toLowerCase()}}</span><input v-model="query" type="search" class="input-base" :placeholder="`Search ${tabLabel(tab).toLowerCase()}…`" /></label></template>
    <div v-motion-panel="tab" class="compendium-content">
    <div v-if="tab!=='homebrew'" v-stable-loading="loading" class="panel compendium-filter-panel" role="region" aria-label="Compendium filters" :aria-busy="loading">
      <ItemFilters v-if="tab==='magic-items'||tab==='equipment'" v-model="filters" :extra-tags="extraTags" :magic-only="tab==='magic-items'" :hide-reset="true" />
      <CompendiumFilters v-else v-model="categoryFilters" :fields="categoryFields" />
      <div class="compendium-filter-footer">
        <CompendiumFilters v-model="categoryFilters" :fields="commonFields" />
        <p role="status">{{loading?'Searching the library…':error?'Search unavailable':pageInfo?`${pageInfo.total} matching ${tab==='monsters'?'creatures':isItemTab?'items':'entries'} · ${pageInfo.matchedEntries} of ${pageInfo.totalEntries} source entries`:''}}</p>
        <button v-if="hasFilters" type="button" class="btn-ghost text-sm" @click="clearFilters">Clear filters</button>
      </div>
      <p v-if="tab==='magic-items'" class="compendium-filter-note">Weapon and damage filters include allowed base weapons and extra attack damage.</p>
      <p v-if="tab==='magic-items'&&!loading&&unclassifiedMagicItems" class="compendium-filter-note">{{unclassifiedMagicItems}} SRD entries have no item tags yet. Clear filters to see them.</p>
    </div>
    <OrcbrewPacks v-if="tab === 'homebrew'" />
    <template v-else>
      <p v-if="error" class="text-sm text-[var(--site-danger)] mb-3" role="alert">{{ error }} <button type="button" class="btn-ghost" @click="search(1,true)">Retry content</button></p>
      <div class="compendium-browser">
        <div ref="resultPanel" class="panel p-4 compendium-results" role="region" aria-label="Matching entries" :aria-busy="loading">
          <p v-if="loading" class="text-sm">Loading…</p>
          <p v-else-if="error" class="text-sm">Search could not complete. Use Retry content above.</p>
          <p v-else-if="!visibleResults.length" class="text-sm">No matching entries. Try another search or clear your filters.</p>
          <ul v-else class="space-y-1">
            <template v-if="tab==='monsters'"><li v-for="group in monsterGroups" :key="group.key"><button class="w-full text-left p-2 rounded hover:bg-[var(--cb-soft)] text-sm" :aria-current="group.versions.some(v=>v.index===selectedDetailIndex)?'true':undefined" @mouseenter="preloader.prioritize(preferredMonsterIndex(group.versions))" @mouseleave="preloader.cancelPriority(preferredMonsterIndex(group.versions))" @focus="preloader.prioritize(preferredMonsterIndex(group.versions))" @blur="preloader.cancelPriority(preferredMonsterIndex(group.versions))" @click="openDetail(preferredMonsterIndex(group.versions))">{{group.name}}<small class="monster-version-count">{{group.choices.length}} {{group.choices.length===1?'version':'versions'}}</small></button></li></template>
            <template v-else-if="tab==='subclasses'"><li v-for="group in subclassGroups" :key="group.key"><button class="w-full text-left p-2 rounded hover:bg-[var(--cb-soft)] text-sm" :aria-current="group.versions.some(v=>v.index===selectedDetailIndex)?'true':undefined" @mouseenter="preloader.prioritize(group.versions[0]!.index)" @mouseleave="preloader.cancelPriority(group.versions[0]!.index)" @focus="preloader.prioritize(group.versions[0]!.index)" @blur="preloader.cancelPriority(group.versions[0]!.index)" @click="openDetail(group.versions[0]!.index)">{{group.name}}<small class="monster-version-count">{{group.classKey?facetLabel('parentClass',group.classKey):'Class unspecified'}} · {{group.versions.length}} {{group.versions.length===1?'version':'versions'}}</small></button></li></template>
            <template v-else-if="isItemTab"><li v-for="group in itemGroups" :key="group.key"><button class="w-full text-left p-2 rounded hover:bg-[var(--cb-soft)] text-sm" :aria-current="group.versions.some(v=>v.index===selectedDetailIndex)?'true':undefined" @mouseenter="preloader.prioritize(preferredItemIndex(group.versions))" @mouseleave="preloader.cancelPriority(preferredItemIndex(group.versions))" @focus="preloader.prioritize(preferredItemIndex(group.versions))" @blur="preloader.cancelPriority(preferredItemIndex(group.versions))" @click="openDetail(preferredItemIndex(group.versions))">{{group.name}}<small v-if="group.versions.length>1" class="monster-version-count">{{group.versions.length}} versions</small></button></li></template>
            <template v-else-if="isFamilyTab"><li v-for="group in familyGroups" :key="group.key"><button class="w-full text-left p-2 rounded hover:bg-[var(--cb-soft)] text-sm" :aria-current="group.versions.some(v=>v.index===selectedDetailIndex)?'true':undefined" @mouseenter="preloader.prioritize(group.versions[0]!.index)" @mouseleave="preloader.cancelPriority(group.versions[0]!.index)" @focus="preloader.prioritize(group.versions[0]!.index)" @blur="preloader.cancelPriority(group.versions[0]!.index)" @click="openDetail(group.versions[0]!.index)">{{group.name}}<small class="monster-version-count"><template v-if="group.scope">{{group.scope.startsWith('unknown:')?'Parent race unspecified':facetLabel(tab==='subraces'?'parentRace':'optionType',group.scope)}} · </template>{{group.versions.length}} {{group.versions.length===1?'version':'versions'}}</small></button></li></template>
            <template v-else><li v-for="entry in visibleResults" :key="entry.index">
              <button class="w-full text-left p-2 rounded hover:bg-[var(--cb-soft)] text-sm" :aria-current="selectedDetailIndex===entry.index?'true':undefined" @mouseenter="preloader.prioritize(entry.index)" @mouseleave="preloader.cancelPriority(entry.index)" @focus="preloader.prioritize(entry.index)" @blur="preloader.cancelPriority(entry.index)" @click="openDetail(entry.index)">
                {{ contentLabel(entry) }}
              </button>
            </li></template>
          </ul>
          <nav v-if="pageInfo&&!error" class="compendium-pagination" aria-label="Result pages">
            <p aria-live="polite">{{pageInfo.total?`${(pageInfo.page-1)*pageInfo.pageSize+1}–${Math.min(pageInfo.page*pageInfo.pageSize,pageInfo.total)} of ${pageInfo.total}`:'0 results'}} <span>· Page {{pageInfo.page}} of {{pageInfo.pages}}</span></p>
            <div><button type="button" class="btn-ghost" :disabled="loading||pageInfo.page<=1" @click="search(pageInfo.page-1)">Previous</button><button type="button" class="btn-ghost" :disabled="loading||pageInfo.page>=pageInfo.pages" @click="search(pageInfo.page+1)">Next</button></div>
          </nav>
        </div>
        <div class="compendium-detail-host"><Teleport :to="focusDialog?.body??'body'" :disabled="!focused||!focusDialog?.body"><div ref="detailPanel" class="panel p-6 compendium-detail" tabindex="0" role="region" aria-label="Entry details" :aria-busy="detailLoading">
          <p v-if="detailError" role="alert" class="text-sm text-[var(--site-danger)] mb-3">{{detailError}}</p>
          <div v-if="detail&&!detailLoading" class="compendium-edition-actions"><span v-if="editions.has(detail.index)&&Object.keys(editions.get(detail.index)??{}).length" class="compendium-edition-label">Your personal edition</span><div class="compendium-reading-actions"><button v-show="!focused" type="button" class="btn-ghost" @click="openFocus">Focus view</button><button type="button" class="btn-ghost" @click="editEntry">Edit entry</button></div></div>
          <label v-if="isFamilyTab&&selectedFamilyGroup&&selectedFamilyGroup.versions.length>1" class="monster-version-selector">Source / option / version<select :value="selectedDetailIndex" class="input-base" @change="openDetail(($event.target as HTMLSelectElement).value)"><option v-for="entry in selectedFamilyGroup.versions" :key="entry.index" :value="entry.index">{{familyOptionLabel(entry)}}</option></select><small>Each version keeps its own rules. Search and filters apply to individual versions.</small></label>
          <label v-if="tab==='subclasses'&&selectedSubclassGroup&&selectedSubclassGroup.versions.length>1" class="monster-version-selector">Source / option / version<select :value="selectedDetailIndex" class="input-base" @change="openDetail(($event.target as HTMLSelectElement).value)"><option v-for="entry in selectedSubclassGroup.versions" :key="entry.index" :value="entry.index">{{subclassOptionLabel(entry)}}</option></select><small>Each version keeps its own features and rules. Search and filters apply to individual versions.</small></label>
          <label v-if="isItemTab&&selectedItemGroup&&selectedItemGroup.versions.length>1" class="monster-version-selector">Source / version<select :value="selectedDetailIndex" class="input-base" @change="openDetail(($event.target as HTMLSelectElement).value)"><option v-for="entry in selectedItemGroup.versions" :key="entry.index" :value="entry.index">{{itemOptionLabel(entry)}}</option></select><small>Each version retains its source rules. Filters apply to individual versions.</small></label>
          <label v-if="tab==='monsters'&&selectedMonsterGroup" class="monster-version-selector">Source / form / version<select :value="selectedMonsterChoice" class="input-base" @change="selectMonsterVersion"><option v-for="(choice,i) in selectedMonsterGroup.choices" :key="choice.entry.index" :value="choice.entry.index">{{monsterVersionLabel(choice.entry)}}{{selectedMonsterGroup.choices.filter(c=>monsterVersionLabel(c.entry)===monsterVersionLabel(choice.entry)).length>1?` · version ${i+1}`:''}}{{choice.copies.length>1?` · ${choice.copies.length} identical source copies`:''}}</option></select><small>Each version retains its own statblock. Filters apply to individual versions.</small></label>
          <div v-motion-panel="detail ? `${tab}:${detail.index}` : null" class="compendium-detail-content">
          <p v-if="detailLoading" role="status">Loading details…</p>
          <p v-else-if="!detail">Select an entry to read its description.</p>
          <MonsterStatblock v-else-if="tab==='monsters'" :monster="monsterDetail" :original="detail.details??detail" />
          <div v-else>
            <h2 class="font-display text-2xl text-[var(--color-gold-soft)] mb-2">{{ detail.name }}</h2>
            <p v-if="detail.sourcePack" class="text-sm mb-4">{{ detail.sourcePack }}</p>
            <ImportedItemDetails v-if="isItemTab&&detail.itemView" :key="detail.index" :view="detail.itemView" />
            <template v-else-if="tab === 'spells'">
              <p class="text-sm mb-4">
                Level {{ spellDetail?.level }} {{ spellDetail?.school?.name }} · {{ spellDetail?.casting_time }} · {{ spellDetail?.range }}
                <br />{{ spellDetail?.components?.join(', ') }} · {{ spellDetail?.duration }}{{ spellDetail?.concentration ? ' · Concentration' : '' }}{{ spellDetail?.ritual ? ' · Ritual' : '' }}
              </p>
              <p v-if="detail.material" class="text-sm mb-4">Material: {{detail.material}}</p>
              <p v-for="(paragraph, index) in spellDetail?.desc ?? []" :key="index" class="mb-3 whitespace-pre-wrap leading-relaxed">{{ paragraph }}</p>
              <template v-if="spellDetail?.higher_level?.length"><h3 class="font-display text-lg mb-2">At higher levels</h3><p v-for="(paragraph,index) in spellDetail.higher_level" :key="`higher-${index}`" class="mb-3 whitespace-pre-wrap leading-relaxed">{{paragraph}}</p></template>
              <p v-if="!spellDetail?.desc?.length" class="text-sm">This source does not include a spell description.</p>
            </template>
            <template v-else-if="(tab==='equipment'||tab==='magic-items')&&detail.workshopItem"><ItemRules :item="detail.workshopItem" /><p v-if="detail.workshopItem.weapon" class="text-sm mt-3">{{detail.workshopItem.weapon.dice}} {{detail.workshopItem.weapon.damageType}} · {{detail.workshopItem.weapon.category}} · {{detail.workshopItem.weapon.range}}</p><p v-if="detail.workshopItem.armor" class="text-sm mt-3">Base {{detail.workshopItem.armor.shield?'shield bonus':'AC'}}: {{detail.workshopItem.armor.base}}{{detail.workshopItem.armor.dex?' + DEX':''}}{{detail.workshopItem.armor.cap!==undefined?` (maximum +${detail.workshopItem.armor.cap})`:''}}</p></template>
            <template v-else-if="tab === 'equipment' || tab === 'magic-items'">
              <p class="text-sm mb-4">SRD 2014</p>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-5">
                <div v-for="[label, value] in itemStats" :key="label">
                  <dt class="text-sm opacity-80">{{ label }}</dt>
                  <dd>{{ value }}</dd>
                </div>
              </dl>
              <p v-for="(paragraph, index) in itemDetail?.desc ?? []" :key="`desc-${index}`" class="mb-3 whitespace-pre-wrap leading-relaxed">{{ paragraph }}</p>
              <p v-for="(paragraph, index) in itemDetail?.special ?? []" :key="`special-${index}`" class="mb-3 whitespace-pre-wrap leading-relaxed">{{ paragraph }}</p>
              <template v-if="itemDetail?.contents?.length">
                <h3 class="font-display text-lg mb-2">Contents</h3>
                <ul class="list-disc pl-5 mb-4"><li v-for="content in itemDetail.contents" :key="content.item.index">{{ content.quantity }} × {{ content.item.name }}</li></ul>
              </template>
              <template v-if="itemDetail?.variants?.length">
                <h3 class="font-display text-lg mb-2">Variants</h3>
                <div class="flex flex-wrap gap-2"><button v-for="variant in itemDetail.variants" :key="variant.index" class="btn-ghost text-sm" @click="openDetail(variant.index)">{{ variant.name }}</button></div>
              </template>
            </template>
            <ReferenceReader v-else :key="`${tab}:${detail.index}`" :entry="detail" :kind="tab" :owner="auth.user?.id" :levels="levels" :levels-loading="levelsLoading" :levels-error="levelsError" @retry-levels="loadLevels(detail.index,tab)" />
          </div>
          </div>
        </div></Teleport></div>
      </div>
    </template>
    </div>
    <p class="text-xs mt-6 opacity-80">Standard rules: SRD 5.1 by Wizards of the Coast LLC · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Data from <a href="https://github.com/5e-bits/5e-srd-api" target="_blank" rel="noopener noreferrer">5e Bits</a>.</p>
    <CompendiumFocusDialog ref="focusDialog" :open="focused" @close="closeFocus" />
    <CompendiumEntryEditor v-if="editing" :key="`${editing.kind}:${editing.index}`" :kind="editing.kind" :index="editing.index" @close="editing=null" @saved="savedEdition" />
  </div>
</template>
