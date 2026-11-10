<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {api,ApiError} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import type {CompendiumKind} from '../../../shared/compendium-editing'
import type {DefinitionReview,DefinitionReviewRow} from '../../../shared/definition-review'
import ReferenceValue from './ReferenceValue.vue'
import './entry-editor.css'

const props=defineProps<{kind:CompendiumKind;index:string;version?:string|number;disabled?:boolean;characterId?:string}>()
const emit=defineEmits<{busy:[boolean];applied:[string]}>()
const auth=useAuthStore(),review=ref<DefinitionReview|null>(null),busy=ref(false),error=ref(''),notice=ref(''),stale=ref(false)
const confirmed=ref<Record<string,boolean>>({}),applied=ref<Record<string,boolean>>({})
const path=computed(()=>`/api/compendium/${props.kind}/${encodeURIComponent(props.index)}`)
let generation=0,controller:AbortController|undefined
function reset(){++generation;controller?.abort();review.value=null;error.value='';notice.value='';stale.value=false;confirmed.value={};applied.value={}}
function displayValue(value:unknown):unknown{return Array.isArray(value)?value.map(displayValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['index','url'].includes(key)).map(([key,child])=>[key,displayValue(child)])):value}
function canApply(row:DefinitionReviewRow){return (!props.characterId||row.id===props.characterId)&&!props.disabled&&!busy.value&&!stale.value&&!applied.value[row.id]&&!row.alreadyReviewed&&!row.blocked&&(!row.sourceConfirmation||!!confirmed.value[row.id])}
async function load(){
 if(props.disabled||busy.value)return
 const run=++generation;controller?.abort();controller=new AbortController();busy.value=true;emit('busy',true);error.value='';notice.value=''
 try{const value=await api.get<DefinitionReview>(path.value+'/review',{timeoutMs:60000,signal:controller.signal});if(run!==generation)return;review.value=props.characterId?{...value,characters:value.characters.filter(row=>row.id===props.characterId)}:value;confirmed.value={};applied.value={};stale.value=false}
 catch(e){if(run===generation)error.value=(e as Error).message}
 finally{busy.value=false;emit('busy',false)}
}
async function apply(row:DefinitionReviewRow){
 if(!review.value||!canApply(row))return
 const run=generation;busy.value=true;emit('busy',true);error.value=''
 try{await api.post(path.value+'/review/'+row.id,{expectedRevision:review.value.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:confirmed.value[row.id]??false});if(run!==generation)return;applied.value[row.id]=true;notice.value=`Reviewed rules applied to ${row.name}.`;emit('applied',row.name)}
 catch(e){if(run===generation){error.value=(e as Error).message;stale.value=e instanceof ApiError&&e.status===409}}
 finally{busy.value=false;emit('busy',false)}
}
watch(()=>[props.kind,props.index,props.version,props.characterId,auth.user?.id],reset,{flush:'sync'})
// An unsaved edit invalidates the comparison even if the user later undoes it.
watch(()=>props.disabled,value=>{if(value)reset()},{flush:'sync'})
onBeforeUnmount(reset)
</script>
<template>
 <section class="entry-review definition-review" aria-label="Review existing characters" :aria-busy="busy">
  <h3 class="font-display">Review existing characters</h3>
  <p class="entry-hint">Compare the saved rules with each affected character, then apply the changes. Current HP, spent uses, inventory quantities and player choices are preserved.</p>
  <button type="button" class="btn-ghost" :disabled="disabled||busy" @click="load">{{busy?'Preparing review…':review?'Refresh character review':'Find affected characters'}}</button>
  <p v-if="disabled" class="entry-hint">Save your changes before reviewing characters.</p>
  <p v-if="error" class="entry-error" role="alert">{{error}}</p><p v-if="stale" class="entry-hint">Refresh character review to compare the latest saved versions.</p>
  <p v-if="notice" class="entry-callout" role="status">{{notice}}</p>
  <p v-if="review&&!review.characters.length" role="status">No existing characters use this entry.</p>
  <details v-for="row in review?.characters??[]" :key="row.id" class="entry-field-group" :open="review?.characters.length===1">
   <summary>{{row.name}} <small>{{applied[row.id]||row.alreadyReviewed?'Reviewed':'Review required'}}</small></summary>
   <div class="entry-review-body">
    <table v-if="row.statistics?.length" class="definition-review-stats"><caption>Character statistics</caption><thead><tr><th scope="col">Statistic</th><th scope="col">Current</th><th scope="col">After applying</th></tr></thead><tbody><tr v-for="stat in row.statistics" :key="stat.label"><th scope="row">{{stat.label}}</th><td>{{stat.before}}</td><td>{{stat.after}}</td></tr></tbody></table>
    <p v-for="warning in row.warnings" :key="warning" class="entry-callout">{{warning}}</p>
    <p v-if="!row.changes.length" class="entry-hint">No saved statistics need changing. Applying records this definition for the character’s reference rules.</p>
    <details v-if="row.changes.length" class="definition-review-details"><summary>All rule changes</summary><div v-for="change in row.changes" :key="change.field" class="entry-review-change"><h4>{{change.field}}</h4><div class="entry-comparison"><section><h5>Current</h5><ReferenceValue :value="displayValue(change.before)" /></section><section><h5>Proposed</h5><ReferenceValue :value="displayValue(change.after)" /></section></div></div></details>
    <label v-if="row.sourceConfirmation" class="entry-check"><input v-model="confirmed[row.id]" type="checkbox" :disabled="disabled||busy||!!applied[row.id]||row.alreadyReviewed" />This is the intended source for {{row.name}}.</label>
    <button type="button" class="btn-primary" :disabled="!canApply(row)" @click="apply(row)">{{applied[row.id]?'Applied':`Apply reviewed rules to ${row.name}`}}</button>
   </div>
  </details>
 </section>
</template>
<style scoped>
.definition-review>p{max-width:76ch}.definition-review-stats{width:100%;border-collapse:collapse;margin:16px 0;font-variant-numeric:tabular-nums;text-align:left}.definition-review-stats caption{text-align:left;font-weight:600;margin-bottom:8px}.definition-review-stats th,.definition-review-stats td{padding:10px 8px;border-bottom:1px solid var(--cb-line);overflow-wrap:anywhere}.definition-review-stats tbody td:last-child{color:var(--color-gold-soft);font-weight:600}.definition-review-details{margin:16px 0}.definition-review-details>summary{cursor:pointer}.definition-review button:focus-visible,.definition-review summary:focus-visible{outline:2px solid var(--color-gold-soft);outline-offset:3px}
</style>
