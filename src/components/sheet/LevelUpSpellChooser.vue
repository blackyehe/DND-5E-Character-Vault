<script setup lang="ts">
import {computed,onBeforeUnmount,reactive,ref,watch} from 'vue'
import {contentLabel,type SrdSpell} from '../../lib/srd'
import {queryAdvancementSpells,type AdvancementSpell,type SpellOrder} from '../../lib/advancement-spells'
import {spellReferenceLabel} from '../../lib/spell-reference'
import SpellCastingDetails from '../SpellCastingDetails.vue'
import FeatureText from './FeatureText.vue'
const props=defineProps<{spells:AdvancementSpell[];selected:string[];loadDefinition:(index:string)=>Promise<SrdSpell>;remainingSpells?:number;remainingCantrips?:number;disabled?:boolean;loading?:boolean;label:string;granted?:boolean}>()
const emit=defineEmits<{add:[spell:AdvancementSpell];remove:[index:string]}>()
const query=ref(''),level=ref(''),order=ref<SpellOrder>('level'),page=ref(1),pageSize=20
const definitions=reactive<Record<string,SrdSpell>>({}),errors=reactive<Record<string,string>>({}),busy=reactive(new Set<string>()),opened=reactive(new Set<string>())
const matches=computed(()=>queryAdvancementSpells(props.spells,query.value,level.value,order.value))
const pages=computed(()=>Math.max(1,Math.ceil(matches.value.length/pageSize))),currentPage=computed(()=>Math.min(page.value,pages.value)),visible=computed(()=>matches.value.slice((currentPage.value-1)*pageSize,currentPage.value*pageSize))
const levels=computed(()=>[...new Set(props.spells.map(s=>s.level))].sort((a,b)=>a-b))
watch([query,level,order],()=>{page.value=1})
let alive=true
onBeforeUnmount(()=>{alive=false})
const name=(id:string)=>{const s=props.spells.find(s=>s.index===id);return s?contentLabel(s):spellReferenceLabel(id)}
function reset(){query.value='';level.value='';page.value=1}
async function inspect(spell:AdvancementSpell){
 if(busy.has(spell.index)||definitions[spell.index])return
 busy.add(spell.index);delete errors[spell.index]
 try{const detail=await props.loadDefinition(spell.index);if(!alive)return;if(detail.definitionAvailable===false||!detail.desc?.some(line=>line.trim()))throw Error('This spell has no available rules definition.');if(detail.level!==spell.level)throw Error('This spell changed. Reload spell choices before learning it.');definitions[spell.index]=detail}
 catch(e){if(alive)errors[spell.index]=e instanceof Error?e.message:'Spell rules could not load.'}
 finally{if(alive)busy.delete(spell.index)}
}
function toggle(spell:AdvancementSpell,event:Event){const open=(event.target as HTMLDetailsElement).open;if(open){opened.add(spell.index);void inspect(spell)}else opened.delete(spell.index)}
const full=(s:AdvancementSpell)=>!props.granted&&(s.level===0?(props.remainingCantrips??0):(props.remainingSpells??0))<=0
function add(s:AdvancementSpell){if(props.disabled||full(s)||!definitions[s.index]||props.selected.includes(s.index))return;emit('add',s)}
</script>
<template>
 <section class="level-up-inline-spells" :aria-label="label" :aria-busy="!!loading">
  <div class="level-up-spell-filters"><label>Find a spell<input v-model="query" type="search" placeholder="Name or source…" /></label><label>Sort by<select v-model="order" aria-label="Sort spells"><option value="level">Level, then name</option><option value="name">Name A–Z</option><option value="source">Source, then name</option></select></label><label>Spell level<select v-model="level" aria-label="Spell level"><option value="">All eligible</option><option v-for="n in levels" :key="n" :value="String(n)">{{n===0?'Cantrips':`Level ${n}`}}</option></select></label></div>
  <div class="level-up-spell-count"><p class="sheet-small" role="status">{{loading?'Loading spell choices…':matches.length?`Showing ${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,matches.length)} of ${matches.length} matching spells`:'No matching eligible spells.'}}</p><button v-if="query||level" type="button" class="sheet-button sheet-small-button" @click="reset">Clear filters</button></div>
  <ul v-if="selected.length" class="level-up-chosen"><li v-for="id in selected" :key="id">{{name(id)}}<button type="button" class="sheet-button sheet-small-button" :disabled="disabled" :aria-label="`Remove ${name(id)}`" @click="emit('remove',id)">Remove</button></li></ul>
  <details v-for="s in visible" :key="s.index" class="level-up-spell-choice" :open="opened.has(s.index)" @toggle="toggle(s,$event)"><summary><span><strong>{{contentLabel(s)}}</strong><small>{{s.level===0?'Cantrip':`Level ${s.level}`}} · {{s.sourcePack||'SRD 2014'}}</small></span><small v-if="selected.includes(s.index)">Selected</small><span class="level-up-spell-arrow" aria-hidden="true">⌄</span></summary><div class="level-up-spell-rules"><p v-if="busy.has(s.index)" class="sheet-small" role="status">Loading spell rules…</p><div v-if="errors[s.index]" class="sheet-alert" role="alert"><p>{{errors[s.index]}}</p><button type="button" class="sheet-button" :disabled="busy.has(s.index)" @click="inspect(s)">Retry spell rules</button></div><template v-if="definitions[s.index]"><p class="sheet-small">{{definitions[s.index]!.school?.name}}<template v-if="definitions[s.index]!.referenceFallback"> · Using matching SRD rules</template></p><SpellCastingDetails :spell="definitions[s.index]!" /><FeatureText :text="definitions[s.index]!.desc.join('\n\n')" /><p v-for="(text,i) in definitions[s.index]!.higher_level" :key="i" class="sheet-prose"><strong>At higher levels: </strong>{{text}}</p><button v-if="selected.includes(s.index)" type="button" class="sheet-button" :disabled="disabled" @click="emit('remove',s.index)">Remove {{contentLabel(s)}}</button><button v-else type="button" class="sheet-button" :disabled="disabled||full(s)" @click="add(s)">{{granted?'Add granted spell':'Learn '+contentLabel(s)}}</button><p v-if="!selected.includes(s.index)&&full(s)" class="sheet-small">Your {{s.level===0?'cantrip':'spell'}} choices are full. Remove a choice to select another.</p></template></div></details>
  <nav v-if="pages>1" class="level-up-spell-pages" aria-label="Spell choice pages"><button type="button" class="sheet-button" :disabled="currentPage===1" @click="page=currentPage-1">Previous spells</button><span class="sheet-small">Page {{currentPage}} of {{pages}}</span><button type="button" class="sheet-button" :disabled="currentPage===pages" @click="page=currentPage+1">Next spells</button></nav>
 </section>
</template>
<style scoped>
.level-up-inline-spells{min-width:0}.level-up-spell-filters{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,.6fr) minmax(110px,.4fr);gap:12px}.level-up-spell-filters label{min-width:0}.level-up-spell-filters :is(input,select){width:100%;min-width:0}.level-up-spell-count,.level-up-spell-pages{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:12px 0}.level-up-spell-choice{background:var(--sheet-entry-bg);border:0;border-radius:6px;overflow:hidden;margin:8px 0}.level-up-spell-choice>summary{display:flex;gap:10px;align-items:center;min-height:64px;padding:12px 14px;cursor:pointer;list-style:none;color:var(--cb-ink)}.level-up-spell-choice>summary::-webkit-details-marker{display:none}.level-up-spell-choice>summary>span:first-child{display:grid;gap:3px;flex:1;min-width:0;overflow-wrap:anywhere}.level-up-spell-choice strong{font-weight:600}.level-up-spell-choice small{font-size:12px}.level-up-spell-arrow{flex-shrink:0}.level-up-spell-choice[open] .level-up-spell-arrow{transform:rotate(180deg)}.level-up-spell-rules{background:var(--sheet-body-bg);padding:12px 14px;overflow-wrap:anywhere}.level-up-spell-rules>.sheet-button{margin-top:12px}.level-up-spell-choice>summary:hover{background:var(--sheet-hover-bg)}.level-up-spell-choice>summary:focus-visible{outline:2px solid var(--cb-accent-mark);outline-offset:-3px}@media(max-width:600px){.level-up-spell-filters{grid-template-columns:1fr 1fr}.level-up-spell-filters>label:first-child{grid-column:1/-1}.level-up-spell-choice>summary,.level-up-spell-rules{padding:10px}}
</style>
