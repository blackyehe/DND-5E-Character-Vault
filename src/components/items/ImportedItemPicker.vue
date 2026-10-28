<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import type { BrowseEntry } from '../../../shared/compendium-browse'
import type { EquipmentItem } from '../../../shared/character'
import { importedEquipment } from '../../../shared/imported-items'
import { useCompendiumBrowse } from '../../composables/useCompendiumBrowse'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'
import { emptyItemFilters } from '../../lib/magic-item-filters'
import ItemFilters from './ItemFilters.vue'

const emit=defineEmits<{choose:[item:EquipmentItem,source:string];busy:[value:boolean]}>()
const auth=useAuthStore(),browse=useCompendiumBrowse(()=>auth.user?.id)
const kind=ref<'equipment'|'magic-items'>('magic-items'),query=ref(''),filters=ref(emptyItemFilters()),page=ref(1),selecting=ref(false),error=ref('')
let timer:ReturnType<typeof setTimeout>|undefined,generation=0,disposed=false
async function search(force=false){await browse.load(kind.value,{query:query.value,page:page.value,facets:{origin:'imported'},items:filters.value},force)}
watch(()=>auth.user?.id,()=>browse.clear())
watch([kind,query,()=>JSON.stringify(filters.value),()=>auth.user?.id],()=>{generation++;browse.cancel();browse.response.value=null;page.value=1;error.value='';clearTimeout(timer);timer=setTimeout(()=>void search(),200)},{immediate:true})
function paginate(value:number){page.value=value;void search()}
async function choose(entry:BrowseEntry){
 if(selecting.value||browse.loading.value)return
 const run=++generation,owner=auth.user?.id,category=kind.value
 selecting.value=true;error.value='';emit('busy',true)
 try{
  const full=await api.get<BrowseEntry>(`/api/compendium-browse/${category}/${encodeURIComponent(entry.index)}`,{timeoutMs:60000})
  if(disposed||run!==generation||owner!==auth.user?.id)return
  if(full.index!==entry.index)throw Error('The item definition changed. Refresh the imported items and choose it again.')
  emit('choose',importedEquipment(full,category),full.sourcePack??'Imported content')
 }catch(reason){if(!disposed&&run===generation)error.value=reason instanceof Error?reason.message:'The imported item could not load. Try again.'}
 finally{if(!disposed){selecting.value=false;emit('busy',false)}}
}
onUnmounted(()=>{disposed=true;generation++;clearTimeout(timer);browse.cancel();emit('busy',false)})
</script>

<template>
 <section class="imported-item-picker" aria-label="Imported items" :aria-busy="browse.loading.value||selecting">
  <div class="sheet-filter-buttons"><button type="button" class="sheet-button" :aria-pressed="kind==='magic-items'" :disabled="selecting" @click="kind='magic-items'">Imported magic items</button><button type="button" class="sheet-button" :aria-pressed="kind==='equipment'" :disabled="selecting" @click="kind='equipment'">Imported normal equipment</button></div>
  <label>Search imported items<input v-model="query" type="search" :disabled="selecting" placeholder="Search your imported packs…" /></label>
  <details class="sheet-details"><summary>Filter imported items</summary><ItemFilters v-model="filters" :extra-tags="browse.response.value?.extraTags??[]" /></details>
  <p v-if="browse.loading.value||selecting" class="sheet-small" role="status">{{selecting?'Loading the selected item’s full rules…':'Finding imported items…'}}</p>
  <p v-if="browse.error.value||error" class="sheet-alert" role="alert">{{error||browse.error.value}} <button type="button" class="sheet-button" :disabled="selecting" @click="search(true)">Retry imported items</button></p>
  <p v-if="browse.localState.value==='outdated'" class="sheet-small">Your saved category has changed. These results use your current server library.</p>
  <div class="item-result-list"><button v-for="entry in browse.response.value?.entries??[]" :key="entry.index" type="button" :disabled="selecting||browse.loading.value" @click="choose(entry)"><strong>{{entry.displayName??entry.name}}</strong><small>{{entry.sourcePack??'Imported content'}}</small></button></div>
  <p v-if="browse.response.value&&!browse.loading.value" class="sheet-small">{{browse.response.value.matchedEntries}} matching source entries. <template v-if="!browse.response.value.entries.length">Import an equipment or magic-item pack in the Compendium, or try another search.</template></p>
  <div v-if="browse.response.value&&browse.response.value.pages>1" class="sheet-filter-buttons"><button type="button" class="sheet-button" :disabled="selecting||browse.loading.value||browse.response.value.page<=1" @click="paginate(browse.response.value!.page-1)">Previous imported items</button><span class="sheet-small">Page {{browse.response.value.page}} / {{browse.response.value.pages}}</span><button type="button" class="sheet-button" :disabled="selecting||browse.loading.value||browse.response.value.page>=browse.response.value.pages" @click="paginate(browse.response.value!.page+1)">Next imported items</button></div>
 </section>
</template>
