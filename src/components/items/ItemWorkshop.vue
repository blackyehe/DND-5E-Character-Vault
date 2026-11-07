<script setup lang="ts">
import { computed,onMounted,onUnmounted,ref } from 'vue'
import { api } from '../../lib/api'
import type { EquipmentItem,CharacterSummary } from '../../../shared/character'
import ItemComposer from './ItemComposer.vue'
import WorkshopLibraryTools from '../workshop/WorkshopLibraryTools.vue'
import DeleteCreationButton from '../workshop/DeleteCreationButton.vue'
import ItemFilters from './ItemFilters.vue'
import { emptyItemFilters,itemSearchText,matchesEquipmentItem } from '../../lib/magic-item-filters'
import { equipmentTags,itemClassificationLabel } from '../../../shared/item-classification'
const items=ref<{id:string;item:EquipmentItem}[]>([]),characters=ref<CharacterSummary[]>([]),target=ref(''),query=ref(''),filter=ref('all')
const open=ref(false),mode=ref<'library'|'give'>('library'),initial=ref<EquipmentItem>(),magical=ref(false),message=ref(''),error=ref(''),loading=ref(false)
const filters=ref(emptyItemFilters())
const matches=computed(()=>items.value.filter(e=>(filter.value==='all'||!!e.item.magical===(filter.value==='magic'))&&itemSearchText(e.item).includes(query.value.toLowerCase())&&matchesEquipmentItem(e.item,filters.value)))
let loadRun=0,disposed=false,loadAbort:AbortController|undefined
async function load(){
  const run=++loadRun
  loadAbort?.abort();const controller=new AbortController();loadAbort=controller
  loading.value=true;error.value=''
  try{
    const [nextItems,nextCharacters]=await Promise.all([
      api.get<{id:string;item:EquipmentItem}[]>('/api/items',{signal:controller.signal}),
      api.get<CharacterSummary[]>('/api/characters',{signal:controller.signal}),
    ])
    if(disposed||run!==loadRun)return
    items.value=nextItems;characters.value=nextCharacters
  }catch(e){if(!disposed&&run===loadRun&&!controller.signal.aborted)error.value=e instanceof Error?e.message:'Could not load items.'}
  finally{if(run===loadRun)loading.value=false}
}
function create(value:boolean){mode.value='library';initial.value=undefined;magical.value=value;open.value=true}
function edit(item:EquipmentItem){mode.value='library';initial.value=item;open.value=true}
function give(item:EquipmentItem){mode.value='give';initial.value=item;open.value=true}
async function saved(text:string){message.value=text;await load()}
async function removed(text:string){open.value=false;message.value=text;await load()}
onMounted(load)
onUnmounted(()=>{disposed=true;loadRun++;loadAbort?.abort()})
</script>
<template>
  <section v-stable-loading="loading" class="item-workshop hw-library" aria-label="Item Workshop">
    <WorkshopLibraryTools title="Normal & magic items" description="Create reusable items, record their rules, then give them to a character you own.">
      <template #search><label>Find my items<input v-model="query" type="search" placeholder="Search by name, type or rules…" /></label></template>
      <template #actions><button type="button" class="hw-button" @click="create(false)">+ New normal item</button><button type="button" class="hw-button hw-button-primary" @click="create(true)">+ New magic item</button></template>
      <template #filters><div class="hw-actions" role="group" aria-label="Item library filter"><button v-for="category in (['all','normal','magic'] as const)" :key="category" type="button" class="hw-button" :aria-pressed="filter===category" @click="filter=category">{{category==='all'?'All items':category==='normal'?'Normal items':'Magic items'}}</button></div></template>
      <template #utility><button type="button" class="hw-text-button" :disabled="loading" @click="load">Reload library</button></template>
    </WorkshopLibraryTools>
    <p v-if="message" class="hw-callout" role="status">{{message}}</p><p v-if="error" class="hw-alert" role="alert">{{error}} <button class="hw-text-button" @click="load">Retry</button></p>
    <section class="hw-panel hw-library-settings"><details class="hw-library-details"><summary>Filter by type, tags, rarity or attunement</summary><ItemFilters v-model="filters" :extra-tags="items.flatMap(e=>equipmentTags(e.item))" /></details><label>Give items to<select v-model="target"><option value="">Choose a character…</option><option v-for="c in characters" :key="c._id" :value="c._id">{{c.meta.name}}</option></select></label></section>
    <section class="hw-library-section"><div class="hw-between"><h3>Saved in your item library <span class="hw-pill">{{matches.length}}</span></h3><span class="hw-hint">Reusable copies saved to your account</span></div>
      <p v-if="loading" class="hw-hint" role="status">Loading your items…</p><p v-else-if="!matches.length" class="hw-empty-inline">{{items.length?'No items match. Clear your filters or try another search.':'Create your first item above. You can also choose an SRD item in the creator and save it to your library.'}}</p>
      <div class="hw-library-grid"><article v-for="entry in matches" :key="entry.id" class="hw-creation-card"><button type="button" class="hw-content-card" @click="edit(entry.item)"><span class="hw-card-kind">{{entry.item.magical?'Magic':'Normal'}} · {{entry.item.kind??'Gear'}}</span><strong>{{entry.item.name}}</strong><small v-if="itemClassificationLabel(entry.item)">{{itemClassificationLabel(entry.item)}}</small><span class="hw-card-description">{{entry.item.description?.slice(0,160)||'No additional description.'}}</span><span class="hw-content-footer">Account library <b>Edit item</b></span></button><div class="hw-card-actions"><button type="button" class="hw-text-button" :disabled="!target" @click="give(entry.item)">Give item</button><DeleteCreationButton :target="{scope:'record',id:entry.id,kind:'item',revision:entry.item.templateRevision??0,name:entry.item.name}" @deleted="removed"/></div></article></div>
    </section>
    <ItemComposer v-if="open" :mode="mode" :initial="initial" :initial-magical="magical" :character-id="target" :character-name="characters.find(c=>c._id===target)?.meta.name" @close="open=false" @saved="saved" />
  </section>
</template>
