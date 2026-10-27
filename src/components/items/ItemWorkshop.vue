<script setup lang="ts">
import { computed,onMounted,ref } from 'vue'
import { api } from '../../lib/api'
import type { EquipmentItem,CharacterSummary } from '../../../shared/character'
import ItemComposer from './ItemComposer.vue'
import DeleteCreationButton from '../workshop/DeleteCreationButton.vue'
import ItemFilters from './ItemFilters.vue'
import { emptyItemFilters,itemSearchText,matchesEquipmentItem } from '../../lib/magic-item-filters'
import { equipmentTags,itemClassificationLabel } from '../../../shared/item-classification'
const items=ref<{id:string;item:EquipmentItem}[]>([]),characters=ref<CharacterSummary[]>([]),target=ref(''),query=ref(''),filter=ref('all')
const open=ref(false),mode=ref<'library'|'give'>('library'),initial=ref<EquipmentItem>(),magical=ref(false),message=ref(''),error=ref(''),loading=ref(false)
const filters=ref(emptyItemFilters())
const matches=computed(()=>items.value.filter(e=>(filter.value==='all'||!!e.item.magical===(filter.value==='magic'))&&itemSearchText(e.item).includes(query.value.toLowerCase())&&matchesEquipmentItem(e.item,filters.value)))
async function load(){loading.value=true;error.value='';try{items.value=await api.get('/api/items');characters.value=await api.get('/api/characters')}catch(e){error.value=e instanceof Error?e.message:'Could not load items.'}finally{loading.value=false}}
function create(value:boolean){mode.value='library';initial.value=undefined;magical.value=value;open.value=true}
function edit(item:EquipmentItem){mode.value='library';initial.value=item;open.value=true}
function give(item:EquipmentItem){mode.value='give';initial.value=item;open.value=true}
async function saved(text:string){message.value=text;await load()}
async function removed(text:string){open.value=false;message.value=text;await load()}
onMounted(load)
</script>
<template>
  <section v-stable-loading="loading" class="item-workshop hero-sheet"><header class="sheet-between"><div><p class="sheet-eyebrow">NORMAL & MAGIC ITEMS</p><h2>Item Workshop</h2><p class="sheet-small">Create reusable items, set their rules, then give them to any character you own.</p></div><div class="sheet-filter-buttons"><button type="button" class="sheet-button" @click="create(false)">+ Create normal item</button><button type="button" class="sheet-button sheet-button-primary" @click="create(true)">+ Create magic item</button></div></header>
  <p v-if="message" class="sheet-notice" role="status">{{message}}</p><p v-if="error" class="sheet-alert" role="alert">{{error}} <button class="sheet-button" @click="load">Retry</button></p><section class="sheet-panel"><div class="sheet-two-fields"><label>Find my items<input v-model="query" type="search" placeholder="Search your item library…" /></label><label>Item library filter<select v-model="filter"><option value="all">Normal and magic items</option><option value="normal">Normal items</option><option value="magic">Magic items</option></select></label></div><details class="sheet-details"><summary>Filter by type, tags, rarity or attunement</summary><ItemFilters v-model="filters" :extra-tags="items.flatMap(e=>equipmentTags(e.item))" /></details><label style="margin-top:12px">Give items to<select v-model="target"><option value="">Choose a character…</option><option v-for="c in characters" :key="c._id" :value="c._id">{{c.meta.name}}</option></select></label></section>
  <p v-if="loading" class="sheet-empty" role="status">Loading your items…</p><p v-else-if="!matches.length" class="sheet-empty">{{items.length?'No items match. Clear your filters or try another search.':'Create your first item above. You can also choose an SRD item in the creator and save it to your library.'}}</p><div class="item-workshop-grid"><article v-for="entry in matches" :key="entry.id" class="sheet-panel"><p class="sheet-eyebrow">{{entry.item.magical?'Magic':'Normal'}} · {{entry.item.kind??'Gear'}}</p><h3>{{entry.item.name}}</h3><p v-if="itemClassificationLabel(entry.item)" class="sheet-small">{{itemClassificationLabel(entry.item)}}</p><p class="sheet-small">{{entry.item.description?.slice(0,160)||'No additional description.'}}</p><div class="sheet-filter-buttons"><button class="sheet-button" @click="edit(entry.item)">Edit item</button><button class="sheet-button sheet-button-primary" :disabled="!target" @click="give(entry.item)">Give item</button><DeleteCreationButton :target="{scope:'record',id:entry.id,kind:'item',revision:entry.item.templateRevision??0,name:entry.item.name}" @deleted="removed"/></div></article></div>
  <ItemComposer v-if="open" :mode="mode" :initial="initial" :initial-magical="magical" :character-id="target" :character-name="characters.find(c=>c._id===target)?.meta.name" @close="open=false" @saved="saved" /></section>
</template>
<style scoped>
.item-workshop.hero-sheet{padding:8px 0 28px;max-width:1000px}.item-workshop>header{flex-wrap:wrap;margin-bottom:18px;gap:14px}.item-workshop h2{font:28px Georgia,serif;margin:0 0 8px}.item-workshop-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:18px}.item-workshop-grid h3{text-align:left}.item-workshop-grid .sheet-filter-buttons{margin:12px 0 0}
</style>
