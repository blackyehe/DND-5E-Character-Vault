<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {api} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import type {CompendiumKind} from '../../../shared/compendium-editing'
import type {DefinitionReview,DefinitionReviewRow} from '../../../shared/definition-review'
import {definitionChangeSummary,definitionReviewWarnings} from '../../lib/definition-change-summary'
import ReferenceValue from './ReferenceValue.vue'
import './entry-editor.css'

const props=defineProps<{kind:CompendiumKind;index:string;version?:string|number;disabled?:boolean;characterId?:string;sourceName?:string;hideTrigger?:boolean;autoOpen?:boolean}>()
const emit=defineEmits<{busy:[boolean];applied:[string]}>()
const auth=useAuthStore(),review=ref<DefinitionReview|null>(null),busy=ref(false),error=ref(''),notice=ref(''),stale=ref(false),opened=ref(false)
const selected=ref<string[]>([]),applied=ref<Record<string,boolean>>({}),panel=ref<HTMLElement|null>(null)
const path=computed(()=>`/api/compendium/${props.kind}/${encodeURIComponent(props.index)}`)
let generation=0,controller:AbortController|undefined,origin:HTMLElement|null=null
function reset(){++generation;controller?.abort();review.value=null;error.value='';notice.value='';stale.value=false;selected.value=[];applied.value={};opened.value=false;busy.value=false;emit('busy',false)}
function displayValue(value:unknown):unknown{return Array.isArray(value)?value.map(displayValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['index','url'].includes(key)).map(([key,child])=>[key,displayValue(child)])):value}
function eligible(row:DefinitionReviewRow){return (!props.characterId||row.id===props.characterId)&&!row.alreadyReviewed&&!row.blocked&&!applied.value[row.id]}
const selectedRows=computed(()=>(review.value?.characters??[]).filter(row=>selected.value.includes(row.id)&&eligible(row)))
const canApply=computed(()=>!props.disabled&&!busy.value&&!stale.value&&selectedRows.value.length>0)
const applyLabel=computed(()=>selectedRows.value.length===1?`Update ${selectedRows.value[0]!.name}`:selectedRows.value.length?`Update ${selectedRows.value.length} characters`:'Select characters to update')
async function focusPanel(){await nextTick();panel.value?.focus?.({preventScroll:true});panel.value?.scrollIntoView?.({block:'start'})}
async function load(){
 if(props.disabled||busy.value)return
 const run=++generation;controller?.abort();controller=new AbortController();busy.value=true;emit('busy',true);error.value=''
 try{const value=await api.get<DefinitionReview>(path.value+'/review',{timeoutMs:60000,signal:controller.signal});if(run!==generation)return;review.value=props.characterId?{...value,characters:value.characters.filter(row=>row.id===props.characterId)}:value;applied.value={};selected.value=review.value.characters.filter(eligible).map(row=>row.id);stale.value=false;notice.value=''}
 catch(e){if(run===generation){error.value=(e as Error).message;stale.value=true}}
 finally{if(run===generation){busy.value=false;emit('busy',false)}}
}
async function open(){if(props.disabled||busy.value)return;const run=generation;origin=typeof document!=='undefined'?document.activeElement as HTMLElement|null:null;opened.value=true;await focusPanel();if(run!==generation||!opened.value||props.disabled)return;const loadedGeneration=generation+1;await load();if(loadedGeneration===generation&&opened.value&&!props.disabled)await focusPanel()}
function close(){if(busy.value)return;reset();if(origin?.isConnected)origin.focus()}
async function applySelected(){
 if(!canApply.value||!review.value)return
 const run=generation,revision=review.value.revision,requestPath=path.value,rows=[...selectedRows.value],completed:string[]=[]
 busy.value=true;emit('busy',true);error.value='';notice.value=''
 try{
  for(const row of rows){
   if(run!==generation||props.disabled)break
   try{
    // This single explicit Update action confirms the source shown in the preview.
    await api.post(requestPath+'/review/'+row.id,{expectedRevision:revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:true})
    if(run!==generation)return
    applied.value[row.id]=true;selected.value=selected.value.filter(id=>id!==row.id);completed.push(row.name);notice.value=`Updated ${completed.join(', ')}.`;emit('applied',row.name)
   }catch(e){if(run===generation){error.value=`${row.name}: ${(e as Error).message}`;stale.value=true}break}
  }
 }finally{if(run===generation){busy.value=false;emit('busy',false)}}
}
watch(()=>[props.kind,props.index,props.version,props.characterId,auth.user?.id],reset,{flush:'sync'})
watch(()=>props.disabled,value=>{if(value)reset()},{flush:'sync'})
onMounted(()=>{if(props.autoOpen)void open()})
onBeforeUnmount(reset)
defineExpose({open})
</script>
<template>
 <div v-if="!hideTrigger" class="definition-review-launcher"><button type="button" class="btn-ghost" :disabled="disabled||busy" @click="open">Update existing characters</button><span v-if="disabled" class="entry-hint">Save your changes first.</span></div>
 <section v-if="opened" ref="panel" class="entry-review definition-review" aria-label="Update existing characters" :aria-busy="busy" tabindex="-1">
  <header class="definition-review-header"><div><h3 class="font-display">Update existing characters</h3><p v-if="sourceName" class="entry-hint">{{sourceName}}</p></div><button type="button" class="btn-ghost" :disabled="busy" aria-label="Close character update preview" @click="close">Close</button></header>
  <p v-if="busy" role="status">{{review?'Updating selected characters…':'Checking existing characters…'}}</p>
  <p v-if="error" class="entry-error" role="alert">{{error}}</p><p v-if="stale" class="entry-hint">Refresh the comparison before trying again. Completed updates stay applied.</p>
  <p v-if="notice" class="entry-callout" role="status">{{notice}}</p>
  <p v-if="review&&!review.characters.length" role="status">No existing characters use this entry.</p>
  <article v-for="row in review?.characters??[]" :key="row.id" class="definition-review-character">
   <div class="definition-review-name"><label v-if="review!.characters.length>1" class="entry-check"><input v-model="selected" type="checkbox" :value="row.id" :disabled="busy||stale||!eligible(row)" />{{row.name}}</label><h4 v-else>{{row.name}}</h4><small>{{applied[row.id]?'Updated':row.alreadyReviewed?'Up to date':row.blocked?'Needs attention':'Update available'}}</small></div>
   <template v-if="!row.alreadyReviewed&&!applied[row.id]"><ul class="definition-review-summary"><li v-for="(change,i) in definitionChangeSummary(row,sourceName)" :key="i">{{change.label}}<small v-if="change.detail">{{change.detail}}</small></li></ul>
    <table v-if="row.statistics?.some(s=>s.before!==s.after)" class="definition-review-stats"><caption>Character statistics</caption><thead><tr><th scope="col">Statistic</th><th scope="col">Current</th><th scope="col">After update</th></tr></thead><tbody><tr v-for="stat in row.statistics.filter(s=>s.before!==s.after)" :key="stat.label"><th scope="row">{{stat.label}}</th><td>{{stat.before}}</td><td>{{stat.after}}</td></tr></tbody></table>
    <p v-if="row.statistics?.some(s=>s.before===s.after)" class="entry-hint">{{row.statistics.filter(s=>s.before===s.after).map(s=>`${s.label} ${s.after} · unchanged`).join(' / ')}}</p>
    <p v-for="warning in definitionReviewWarnings(row)" :key="warning" class="entry-callout">{{warning}}</p>
    <details v-if="row.changes.length" class="definition-review-details"><summary>See all changes</summary><div v-for="change in row.changes" :key="change.field" class="entry-review-change"><h4>{{change.field}}</h4><div class="entry-comparison"><section><h5>Current</h5><ReferenceValue :value="displayValue(change.before)" /></section><section><h5>Proposed</h5><ReferenceValue :value="displayValue(change.after)" /></section></div></div></details>
   </template>
  </article>
  <template v-if="review?.characters.some(eligible)"><p class="entry-hint">Current HP, spent uses, inventory quantities, equipment state, personal notes and player choices are preserved.</p><p class="entry-hint">Update the selected characters to use the saved {{sourceName||'entry'}} rules shown above.</p><footer class="definition-review-actions"><button type="button" class="btn-ghost" :disabled="busy" @click="close">Cancel</button><button type="button" class="btn-primary" :disabled="!canApply" @click="applySelected">{{applyLabel}}</button></footer></template>
  <button v-if="review||error" type="button" class="btn-ghost definition-review-refresh" :disabled="disabled||busy" @click="load">Refresh comparison</button>
 </section>
</template>
<style scoped>
.definition-review-launcher{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.definition-review{scroll-margin-block:24px}.definition-review>p{max-width:76ch}.definition-review-header,.definition-review-name{display:flex;align-items:center;justify-content:space-between;gap:12px}.definition-review-header{align-items:start}.definition-review-header h3{margin-top:0}.definition-review-character{margin:14px 0;padding:14px;background:var(--cb-soft);border-radius:6px;min-width:0;overflow-wrap:anywhere}.definition-review-name h4{margin:0;font-weight:600}.definition-review-name .entry-check{margin:0;font-weight:600}.definition-review-name small{font-size:12px}.definition-review-summary{padding-left:20px;margin:12px 0}.definition-review-summary li+li{margin-top:8px}.definition-review-summary small{display:block;font-size:12px;line-height:1.5}.definition-review-stats{width:100%;border-collapse:collapse;margin:16px 0;font-variant-numeric:tabular-nums;text-align:left}.definition-review-stats caption{text-align:left;font-weight:600;margin-bottom:8px}.definition-review-stats th,.definition-review-stats td{padding:10px 8px;border-bottom:1px solid var(--cb-line);overflow-wrap:anywhere}.definition-review-stats tbody td:last-child{color:var(--color-gold-soft);font-weight:600}.definition-review-details{margin:16px 0}.definition-review-details>summary{cursor:pointer}.definition-review-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.definition-review-refresh{margin-top:14px}.definition-review button:focus-visible,.definition-review summary:focus-visible{outline:2px solid var(--color-gold-soft);outline-offset:3px}
</style>
