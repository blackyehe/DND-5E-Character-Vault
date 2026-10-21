<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { vMotionPanel } from '../directives/siteMotion'
import { contentLabel, homebrew, srd, type SrdEquipment, type SrdMagicItem, type SrdRef, type SrdSpell, type SrdLevel } from '../lib/srd'
import OrcbrewPacks from '../components/OrcbrewPacks.vue'
import { hasMagicItemTags,emptyItemFilters,itemSearchText,matchesEquipmentItem,matchesMagicItem,normalEquipmentSearch } from '../lib/magic-item-filters'
import { equipmentTags } from '../../shared/item-classification'
import type { EquipmentItem } from '../../shared/character'
import { api } from '../lib/api'
import ItemFilters from '../components/items/ItemFilters.vue'
import ItemRules from '../components/sheet/ItemRules.vue'
import MonsterStatblock from '../components/monsters/MonsterStatblock.vue'
import ReferenceReader from '../components/compendium/ReferenceReader.vue'
import CompendiumFilters from '../components/compendium/CompendiumFilters.vue'
import CompendiumCategories from '../components/compendium/CompendiumCategories.vue'
import { compendiumTabLabel as tabLabel, type CompendiumTab as Tab } from '../lib/compendium-navigation'
import { availableFacets, categoryFacetDefinitions, commonFacetDefinitions, compendiumFacets, matchesFacets } from '../../shared/compendium-facets'
import { monsterStatblock } from '../../shared/monster-statblock'
import '../components/sheet/sheet.css'
import '../components/sheet/sheet-details.css'
import '../components/compendium/compendium-layout.css'

type Kind = keyof typeof homebrew
type LibraryRef = SrdRef & {workshopItem?:EquipmentItem}
type Detail = LibraryRef & Record<string, unknown>
const tab = ref<Tab>('spells')
const query = ref('')
const results = ref<LibraryRef[]>([])
const filters=ref(emptyItemFilters())
const categoryFilters=ref<Record<string,string>>({})
const indexedResults=computed(()=>results.value.map(entry=>({entry,facts:compendiumFacets(entry,tab.value)})))
const categoryFields=computed(()=>availableFacets(categoryFacetDefinitions(tab.value),indexedResults.value.map(row=>row.facts)))
const commonFields=computed(()=>availableFacets(commonFacetDefinitions,indexedResults.value.map(row=>row.facts)))
const hasFilters=computed(()=>Object.values(categoryFilters.value).some(Boolean)||Object.values(filters.value).some(Boolean))
const visibleResults=computed(()=>indexedResults.value.filter(({entry,facts})=>{
  const term=query.value.trim().toLowerCase()
  const searchable=entry.workshopItem?itemSearchText(entry.workshopItem):tab.value==='equipment'&&normalEquipmentSearch[entry.index]?itemSearchText(normalEquipmentSearch[entry.index]!):contentLabel(entry).toLowerCase()
  if(term&&!searchable.includes(term))return false
  if(!matchesFacets(facts,categoryFilters.value))return false
  if(tab.value!=='equipment'&&tab.value!=='magic-items')return true
  const item=entry.workshopItem??(tab.value==='equipment'?normalEquipmentSearch[entry.index]:undefined)
  return item?matchesEquipmentItem(item,filters.value):tab.value==='magic-items'?matchesMagicItem(entry.index,filters.value):!Object.values(filters.value).some(Boolean)
}).map(row=>row.entry))
function clearFilters(){categoryFilters.value={};filters.value=emptyItemFilters()}
const unclassifiedMagicItems=computed(()=>results.value.filter(entry=>!entry.workshopItem&&!hasMagicItemTags(entry.index)).length)
const loading = ref(false)
const error = ref('')
const detail = ref<Detail | null>(null)
const selectedDetailIndex=ref('')
const detailPanel = ref<HTMLElement | null>(null)
watch(() => detail.value?.index, async () => {
  await nextTick()
  detailPanel.value?.scrollTo({ top:0 })
})
const detailLoading = ref(false)
const levels=ref<SrdLevel[]>([]),levelsLoading=ref(false),levelsError=ref('')
watch(visibleResults, entries => {
  if (selectedDetailIndex.value && !entries.some(entry => entry.index === selectedDetailIndex.value)) {
    ++detailNumber
    selectedDetailIndex.value=''
    detail.value = null
    detailLoading.value = false
  }
})
const spellDetail = computed(() => detail.value as unknown as SrdSpell | null)
const monsterDetail = computed(() => monsterStatblock(detail.value))
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
let customDetails = new Map<string, Detail>()
let requestNumber = 0
let detailNumber = 0

async function search() {
  const sequence = ++requestNumber
  ++detailNumber
  const kind = tab.value
  selectedDetailIndex.value=''
  detail.value = null
  levels.value=[];levelsLoading.value=false;levelsError.value=''
  detailLoading.value = false
  results.value = []
  loading.value = false
  if (kind === 'homebrew') return
  loading.value = true
  error.value = ''
  detail.value = null
  const requests: Promise<LibraryRef[]>[] = [kind in homebrew ? homebrew[kind as Kind]() : Promise.resolve([])]
  if(kind==='equipment'||kind==='magic-items')requests.unshift(api.get<{id:string;item:EquipmentItem}[]>('/api/items').then(items=>items.filter(entry=>!!entry.item.magical===(kind==='magic-items')).map(entry=>({index:`workshop-item-${entry.id}`,name:entry.item.name,displayName:`${entry.item.name} · My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:entry.item}))))
  if (kind === 'equipment') requests.unshift(srd.equipment())
  if (kind === 'magic-items') requests.unshift(srd.magicItems())
  if (['spells','monsters','classes','races','subraces','subclasses','backgrounds','feats','languages'].includes(kind)) requests.unshift(srd.compendium(kind))
  const settled = await Promise.allSettled(requests)
  if (sequence !== requestNumber) return
  const custom = settled[settled.length - 1]
  customDetails = new Map(custom?.status === 'fulfilled'
    ? custom.value.map((item) => [item.index, item as unknown as Detail]) : [])
  const combined=settled.flatMap(result=>result.status==='fulfilled'?result.value:[])
  for(const entry of combined)if(entry.workshopItem)customDetails.set(entry.index,entry as Detail)
  results.value=combined
  if (settled.some((result) => result.status === 'rejected')) error.value = 'Some content could not be loaded. Please try again.'
  loading.value = false
}

watch(tab, () => { clearFilters();search() })
onBeforeUnmount(() => { ++requestNumber; ++detailNumber })

async function openDetail(index: string) {
  const sequence = ++detailNumber
  selectedDetailIndex.value=index
  levels.value=[];levelsLoading.value=false;levelsError.value='';error.value=''
  detailLoading.value=false
  if (customDetails.has(index)) { detail.value = customDetails.get(index) ?? null; return }
  detail.value = null
  detailLoading.value = true
  try {
    const kind = tab.value
    const loaders = { spells: srd.spell, equipment: srd.equipmentItem, 'magic-items': srd.magicItem, monsters: srd.monster, classes: srd.class, races: srd.race,subraces:srd.subrace,subclasses:srd.subclass,backgrounds:srd.background,feats:srd.feat,languages:srd.language }
    if (kind in loaders) {
      const entry = await loaders[kind as keyof typeof loaders](index)
      if (sequence === detailNumber) { detail.value = entry as unknown as Detail;void loadLevels(index,kind,sequence) }
    }
  } catch { if (sequence === detailNumber) error.value = 'Could not load this entry.' }
  finally { if (sequence === detailNumber) detailLoading.value = false }
}
async function loadLevels(index:string,kind:Tab,sequence=detailNumber){
  if(kind!=='classes'&&kind!=='subclasses')return
  levelsLoading.value=true;levelsError.value=''
  try{const values=await (kind==='classes'?srd.classLevels(index):srd.subclassLevels(index));if(sequence===detailNumber&&detail.value?.index===index)levels.value=values}
  catch{if(sequence===detailNumber)levelsError.value='Features by level could not be loaded. The core entry is still available.'}
  finally{if(sequence===detailNumber)levelsLoading.value=false}
}

search()
</script>

<template>
  <div class="compendium-page max-w-5xl mx-auto px-6 py-8">
    <h1 class="font-display text-3xl text-[var(--color-gold-soft)] mb-6">Compendium</h1>
    <CompendiumCategories v-model="tab" />
    <label v-if="tab !== 'homebrew'" class="compendium-search"><span>Search {{tabLabel(tab).toLowerCase()}}</span><input v-model="query" type="search" class="input-base" :placeholder="`Search ${tabLabel(tab).toLowerCase()}…`" /></label>
    <div v-motion-panel="tab" class="compendium-content">
    <div v-if="tab!=='homebrew'" class="panel compendium-filter-panel" role="region" aria-label="Compendium filters" :aria-busy="loading">
      <ItemFilters v-if="tab==='magic-items'||tab==='equipment'" v-model="filters" :extra-tags="results.flatMap(entry=>entry.workshopItem?equipmentTags(entry.workshopItem):[])" :magic-only="tab==='magic-items'" :hide-reset="true" />
      <CompendiumFilters v-else v-model="categoryFilters" :fields="categoryFields" />
      <div class="compendium-filter-footer">
        <CompendiumFilters v-model="categoryFilters" :fields="commonFields" />
        <p role="status">{{loading?'Loading entries…':`${visibleResults.length} of ${results.length} entries`}}</p>
        <button v-if="hasFilters" type="button" class="btn-ghost text-sm" @click="clearFilters">Clear filters</button>
      </div>
      <p v-if="tab==='magic-items'" class="compendium-filter-note">Weapon and damage filters include allowed base weapons and extra attack damage.</p>
      <p v-if="tab==='magic-items'&&!loading&&unclassifiedMagicItems" class="compendium-filter-note">{{unclassifiedMagicItems}} SRD entries have no item tags yet. Clear filters to see them.</p>
    </div>
    <OrcbrewPacks v-if="tab === 'homebrew'" />
    <template v-else>
      <p v-if="error" class="text-sm text-[var(--site-danger)] mb-3" role="alert">{{ error }} <button type="button" class="btn-ghost" @click="search">Retry content</button></p>
      <div class="compendium-browser">
        <div class="panel p-4 compendium-results" role="region" aria-label="Matching entries" :aria-busy="loading">
          <p v-if="loading" class="text-sm">Loading…</p>
          <p v-else-if="!visibleResults.length" class="text-sm">No matching entries. Try another search or clear your filters.</p>
          <ul v-else class="space-y-1">
            <li v-for="entry in visibleResults" :key="entry.index">
              <button class="w-full text-left p-2 rounded hover:bg-[var(--cb-soft)] text-sm" :aria-current="selectedDetailIndex===entry.index?'true':undefined" @click="openDetail(entry.index)">
                {{ contentLabel(entry) }}
              </button>
            </li>
          </ul>
        </div>
        <div ref="detailPanel" class="panel p-6 compendium-detail" tabindex="0" role="region" aria-label="Entry details" :aria-busy="detailLoading">
          <div v-motion-panel="detail ? `${tab}:${detail.index}` : null" class="compendium-detail-content">
          <p v-if="detailLoading" role="status">Loading details…</p>
          <p v-else-if="!detail">Select an entry to read its description.</p>
          <MonsterStatblock v-else-if="tab==='monsters'" :monster="monsterDetail" :original="detail.details??detail" />
          <div v-else>
            <h2 class="font-display text-2xl text-[var(--color-gold-soft)] mb-2">{{ detail.name }}</h2>
            <p v-if="detail.sourcePack" class="text-sm mb-4">{{ detail.sourcePack }}</p>
            <template v-if="tab === 'spells'">
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
            <ReferenceReader v-else :key="`${tab}:${detail.index}`" :entry="detail" :kind="tab" :levels="levels" :levels-loading="levelsLoading" :levels-error="levelsError" @retry-levels="loadLevels(detail.index,tab)" />
          </div>
          </div>
        </div>
      </div>
    </template>
    </div>
    <p class="text-xs mt-6 opacity-80">Standard rules: SRD 5.1 by Wizards of the Coast LLC · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Data from <a href="https://github.com/5e-bits/5e-srd-api" target="_blank" rel="noopener noreferrer">5e Bits</a>.</p>
  </div>
</template>
