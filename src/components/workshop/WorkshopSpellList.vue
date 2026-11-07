<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import CompendiumFilters from '../compendium/CompendiumFilters.vue'
import {spellReferenceLabel} from '../../lib/spell-reference'
import {queryWorkshopSpells,workshopSpellFields,workshopSpellRecords,type WorkshopSpellChoice,type WorkshopSpellOrder} from '../../lib/workshop-spell-list'

const props=defineProps<{spells:WorkshopSpellChoice[];loading?:boolean}>()
const selected=defineModel<string[]>({required:true})
const query=ref(''),facets=ref<Record<string,string>>({}),selection=ref<''|'selected'|'unselected'>(''),order=ref<WorkshopSpellOrder>('level'),page=ref(1)
const pageSize=40
const records=computed(()=>workshopSpellRecords(props.spells)),fields=computed(()=>workshopSpellFields(records.value))
const matches=computed(()=>queryWorkshopSpells(records.value,query.value,facets.value,selected.value,selection.value,order.value))
const pages=computed(()=>Math.max(1,Math.ceil(matches.value.length/pageSize))),currentPage=computed(()=>Math.min(page.value,pages.value))
const visible=computed(()=>matches.value.slice((currentPage.value-1)*pageSize,currentPage.value*pageSize))
const unresolved=computed(()=>selected.value.filter(key=>!props.spells.some(spell=>spell.index===key)))
const activeFilters=computed(()=>Object.values(facets.value).filter(Boolean).length)
watch([query,facets,selection,order],()=>{page.value=1},{deep:true})
function toggle(key:string){selected.value=selected.value.includes(key)?selected.value.filter(value=>value!==key):[...selected.value,key]}
function replace(key:string,event:Event){const value=(event.target as HTMLSelectElement).value;if(value)selected.value=[...new Set(selected.value.map(id=>id===key?value:id))]}
function reset(){query.value='';facets.value={};selection.value='';page.value=1}
</script>

<template>
 <section class="hw-subsection hw-class-spells" aria-labelledby="class-spell-list-title">
  <div class="hw-between"><h3 id="class-spell-list-title">Class spell list</h3><span class="hw-pill">{{selected.length}} selected</span></div>
  <label>Find a spell<input v-model="query" type="search" placeholder="Search your spell library…" /></label>
  <div class="hw-form-grid">
   <label>Sort spells<select v-model="order" aria-label="Sort spells"><option value="level">Spell level, then name</option><option value="name">Name (A–Z)</option><option value="source">Source, then name</option></select></label>
   <label>Selection<select v-model="selection" aria-label="Selection"><option value="">All spells</option><option value="selected">Selected spells</option><option value="unselected">Unselected spells</option></select></label>
  </div>
  <details class="hw-spell-filter-panel"><summary>Filter spells<span v-if="activeFilters"> · {{activeFilters}} active</span></summary><CompendiumFilters v-model="facets" :fields="fields" /></details>
  <div class="hw-between hw-spell-count"><p class="hw-hint" role="status">{{loading?'Loading your spell library…':`${matches.length} matching spell versions · ${records.length} in your library`}}</p><button v-if="query||activeFilters||selection" type="button" class="hw-text-button" @click="reset">Clear filters</button></div>
  <div class="hw-spell-picker" role="region" aria-label="Class spell list" :aria-busy="!!loading" tabindex="0">
   <label v-for="record in visible" :key="record.spell.index" class="hw-spell-option"><input type="checkbox" :checked="selected.includes(record.spell.index)" @change="toggle(record.spell.index)" /><span>{{record.name}}<small>{{record.source}} · {{record.level===undefined?'Level not recorded':record.level===0?'Cantrip':`Spell level ${record.level}`}}</small></span></label>
   <p v-if="!loading&&!visible.length" class="hw-hint">No matching spells. Try changing or clearing the filters.</p>
  </div>
  <nav v-if="pages>1" class="hw-between hw-spell-pagination" aria-label="Class spell list pages"><button type="button" class="hw-button" :disabled="currentPage===1" @click="page=currentPage-1">Previous spells</button><span class="hw-hint">Page {{currentPage}} of {{pages}}</span><button type="button" class="hw-button" :disabled="currentPage===pages" @click="page=currentPage+1">Next spells</button></nav>
  <p class="hw-hint">Each source version is selected separately. Searching, filtering and changing pages keep your selections.</p>
  <details v-if="!loading&&unresolved.length" class="hw-callout"><summary>{{unresolved.length}} original spell references need a match</summary><p>Keep these original references when saving other rule changes, or replace one with a spell from the current results. Search and filter above to find the intended source.</p><div v-for="key in unresolved" :key="key" class="hw-between"><span>{{spellReferenceLabel(key)}}</span><label>Replace definition<select :value="''" aria-label="Replace definition" @change="replace(key,$event)"><option value="" disabled>Choose the correct spell…</option><option v-for="record in visible" :key="record.spell.index" :value="record.spell.index">{{record.name}} · {{record.source}}</option></select></label><button class="hw-text-button" type="button" :aria-label="`Remove unresolved reference ${key}`" @click="toggle(key)">Remove</button></div></details>
 </section>
</template>

<style scoped>
.hw-spell-filter-panel{border:1px solid var(--cb-line);border-radius:7px;padding:12px;min-width:0}
.hw-spell-filter-panel>summary{cursor:pointer;font-size:13px;font-weight:600}
.hw-spell-filter-panel :deep(.compendium-filters){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
.hw-spell-filter-panel :deep(label){min-width:0}
.hw-spell-count,.hw-spell-pagination{gap:12px;flex-wrap:wrap}
.hw-spell-pagination>span{font-variant-numeric:tabular-nums}
.hw-class-spells .hw-spell-picker{scrollbar-gutter:stable}
@media(max-width:480px){.hw-spell-filter-panel :deep(.compendium-filters){grid-template-columns:1fr}}
</style>
