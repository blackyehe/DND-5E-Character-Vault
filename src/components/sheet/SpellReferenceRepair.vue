<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { contentLabel, type SrdSpell } from '../../lib/srd'
import { spellReferenceLabel } from '../../lib/spell-reference'
const props=defineProps<{ids:string[];details:Record<string,SrdSpell>;initial?:string;busy?:boolean;open?:boolean}>()
const emit=defineEmits<{replace:[before:string,after:string]}>()
const library=useSheetLibrary(),selected=ref(props.initial||props.ids.find(id=>!props.details[id])||props.ids[0]||''),query=ref('')
const sourceName=computed(()=>props.details[selected.value]?.name??spellReferenceLabel(selected.value))
let replacement=''
function choose(index:string){replacement=index;emit('replace',selected.value,index)}
watch(()=>props.ids,ids=>{if(!ids.includes(selected.value))selected.value=ids.includes(replacement)?replacement:ids[0]??''})
watch(selected,()=>{query.value=sourceName.value==='Unavailable imported spell'?'':sourceName.value},{immediate:true})
watch(()=>props.initial,id=>{if(id)selected.value=id})
const candidates=computed(()=>library.spellOptions.value.filter(spell=>spell.definitionAvailable!==false&&`${spell.name} ${spell.sourcePack??''}`.toLowerCase().includes(query.value.trim().toLowerCase())).sort((a,b)=>Number(a.index.startsWith('homebrew-'))-Number(b.index.startsWith('homebrew-'))||a.name.localeCompare(b.name)).slice(0,30))
</script>
<template><details class="sheet-details sheet-spell-repair" :open="open||!!initial"><summary>Repair or replace a spell reference</summary><p class="sheet-small" style="margin:12px 0">Choose the current reference, then its correct definition. Replacing preserves whether it was prepared and avoids adding a duplicate. Save character to apply the change.</p><div class="sheet-two-fields"><label>Current spell<select v-model="selected"><option v-for="id in ids" :key="id" :value="id">{{details[id]?.name??spellReferenceLabel(id)}}{{!details[id]?' · definition unavailable':''}}</option></select></label><label>Find the correct spell<input v-model="query" type="search" placeholder="For example, Counterspell" /></label></div><p v-if="library.editorLoading.value" class="sheet-small" role="status">Loading spell choices…</p><div v-else class="sheet-spell-repair-results"><p v-if="!candidates.length" class="sheet-small">No matches. Try the base spell name.</p><div v-for="spell in candidates" :key="spell.index" class="sheet-between"><span>{{contentLabel(spell)}}<small style="display:block" class="sheet-small">{{spell.index.startsWith('homebrew-')?spell.sourcePack||'Homebrew':'SRD 2014'}}</small></span><button type="button" class="sheet-button sheet-small-button" :disabled="!selected||busy||spell.index===selected" @click="choose(spell.index)">{{spell.index===selected?'Current definition':'Use this definition'}}</button></div></div></details></template>
<style scoped>.sheet-spell-repair-results{max-height:300px;overflow:auto;margin-top:12px}.sheet-spell-repair-results>div{gap:12px;padding:9px 0;border-top:1px solid var(--cb-line)}</style>
