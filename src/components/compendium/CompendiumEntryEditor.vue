<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { api, ApiError } from '../../lib/api'
import { cloneEntry, sameEntry, entryProblems, type CompendiumEditState, type CompendiumKind, type EntryData } from '../../../shared/compendium-editing'
import EntryBuilder from './EntryBuilder.vue'
import ReferenceValue from './ReferenceValue.vue'
import './entry-editor.css'
const props=defineProps<{kind:CompendiumKind;index:string}>()
const emit=defineEmits<{close:[];saved:[CompendiumEditState]}>()
const state=ref<CompendiumEditState|null>(null),draft=ref<EntryData>({}),busy=ref(false),loading=ref(true),error=ref(''),notice=ref(''),conflict=ref(false),confirmDiscard=ref(false),confirmRestore=ref(false)
const showSource=ref(false)
// Reference-style objects in a comparison must still show their numerical rules.
function displayValue(value:unknown):unknown {return Array.isArray(value)?value.map(displayValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['index','url'].includes(key)).map(([key,child])=>[key,displayValue(child)])):value}
const pane=ref<HTMLElement|null>(null),origin=document.activeElement as HTMLElement|null
const background=[...document.querySelectorAll<HTMLElement>('.site-shell > *')].map(element=>({element,inert:element.inert}))
const previousOverflow=document.body.style.overflow
const path=`/api/compendium/${props.kind}/${encodeURIComponent(props.index)}`
const dirty=computed(()=>!!state.value&&!sameEntry(draft.value,state.value.entry))
const problems=computed(()=>state.value?entryProblems(state.value.source,draft.value):[])
interface ReviewRow { id:string;name:string;updatedAt:string;reviewHash:string;alreadyReviewed:boolean;sourceConfirmation:boolean;warnings:string[];changes:{field:string;before:unknown;after:unknown}[] }
const review=ref<{revision:number;characters:ReviewRow[]}|null>(null),reviewBusy=ref(false),reviewError=ref(''),confirmed=ref<Record<string,boolean>>({}),applied=ref<Record<string,boolean>>({})
async function load(){loading.value=true;error.value='';try{state.value=await api.get<CompendiumEditState>(path,{timeoutMs:60000});draft.value=cloneEntry(state.value.entry);conflict.value=false;confirmDiscard.value=false;confirmRestore.value=false;review.value=null;await nextTick();pane.value?.focus()}catch(e){error.value=(e as Error).message}finally{loading.value=false}}
function close(){if(busy.value||reviewBusy.value)return;if(dirty.value){confirmDiscard.value=true;return}emit('close')}
async function save(restore=false){
  if(!state.value||busy.value)return
  busy.value=true;error.value='';notice.value=''
  try{
    const result=await api.put<CompendiumEditState>(path,{entry:restore?undefined:draft.value,restore,expectedRevision:state.value.revision,expectedSourceHash:state.value.sourceHash})
    state.value=result;draft.value=cloneEntry(result.entry);conflict.value=false;confirmRestore.value=false;review.value=null;notice.value=restore?'Source restored in your Compendium. Review characters to restore their saved rules too.':'Changes saved to your Compendium. Review existing characters before updating their rules.';emit('saved',result)
  }catch(e){error.value=(e as Error).message;conflict.value=e instanceof ApiError&&e.status===409}finally{busy.value=false}
}
function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(draft.value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${props.index}-draft.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function loadReview(){reviewBusy.value=true;reviewError.value='';try{review.value=await api.get(path+'/review',{timeoutMs:60000});confirmed.value={};applied.value={}}catch(e){reviewError.value=(e as Error).message}finally{reviewBusy.value=false}}
async function apply(row:ReviewRow){if(!review.value)return;reviewBusy.value=true;reviewError.value='';try{await api.post(path+'/review/'+row.id,{expectedRevision:review.value.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:confirmed.value[row.id]??false});applied.value[row.id]=true;notice.value=`Reviewed rules applied to ${row.name}.`}catch(e){reviewError.value=(e as Error).message}finally{reviewBusy.value=false}}
function exit(event:BeforeUnloadEvent){if(dirty.value||busy.value||reviewBusy.value)event.preventDefault()}
function key(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}if(event.key==='Tab'&&pane.value){const nodes=[...pane.value.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"],summary')].filter(e=>e.getClientRects().length>0);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===pane.value)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===pane.value)){event.preventDefault();first?.focus()}}}
onBeforeRouteLeave(()=>{if(dirty.value||busy.value||reviewBusy.value){confirmDiscard.value=dirty.value;return false}})
onMounted(()=>{background.forEach(({element})=>{element.inert=true});document.body.style.overflow='hidden';document.addEventListener('keydown',key,true);window.addEventListener('beforeunload',exit);void load()})
onBeforeUnmount(()=>{background.forEach(({element,inert})=>{element.inert=inert});document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',key,true);window.removeEventListener('beforeunload',exit);origin?.focus()})
</script>
<template><Teleport to=".site-shell"><div class="entry-editor-backdrop"><section ref="pane" class="entry-editor panel" role="dialog" aria-modal="true" aria-labelledby="entry-editor-title" tabindex="-1" :aria-busy="loading||busy||reviewBusy">
  <header class="entry-editor-header"><div><h2 id="entry-editor-title" class="font-display">Edit {{state?.entry.name??'Compendium entry'}}</h2><p class="entry-hint">{{state?.source.sourcePack??'SRD 2014'}} · Your personal edition</p></div><button class="btn-ghost" type="button" :disabled="busy||reviewBusy" @click="close">Close editor</button></header>
  <div v-if="confirmDiscard" class="entry-callout" role="alert"><p>This draft has unsaved changes.</p><button class="btn-ghost" @click="confirmDiscard=false">Keep editing</button><button class="btn-ghost" @click="download">Download draft</button><button class="btn-ghost" @click="emit('close')">Discard and close</button></div>
  <p v-if="loading" role="status">Loading the current source and your saved edition…</p>
  <div v-if="error" class="entry-callout entry-error" role="alert"><p>{{error}}</p><template v-if="conflict"><button class="btn-ghost" @click="download">Download your draft</button><button class="btn-ghost" @click="confirmDiscard=true">Review unsaved draft</button><button class="btn-ghost" @click="download();load()">Download draft and load saved version</button></template><button v-else-if="!state" class="btn-ghost" @click="load">Retry entry</button></div>
  <p v-if="notice" class="entry-callout" role="status">{{notice}}</p>
  <template v-if="state&&!loading"><p class="entry-hint">Save edits for your Compendium here. Source files stay available through Restore source. Existing character rules update only after you review and apply them below.</p><p v-if="state.sourceChanged" class="entry-callout" role="status">The original source has changed since your last edit. Compare the fields before saving this edition again.</p>
    <div class="entry-builder-form"><fieldset :disabled="busy||reviewBusy"><EntryBuilder :key="state.revision+':'+state.sourceHash" v-model="draft" :kind="kind" /></fieldset>
    <p v-if="problems.length" class="entry-error" role="alert">{{problems[0]}}</p>
    <footer class="entry-editor-actions"><button type="button" @click="save()" class="btn-primary" :disabled="busy||reviewBusy||!dirty||!!problems.length">{{busy?'Saving…':'Save changes'}}</button><button type="button" class="btn-ghost" :disabled="busy||reviewBusy" @click="close">Cancel</button><button v-if="state.edited" type="button" class="btn-ghost" :disabled="busy||reviewBusy" @click="confirmRestore=true">Restore source</button><span class="entry-hint">{{dirty?'Unsaved changes':`Saved revision ${state.revision}`}}</span></footer></div>
    <div v-if="confirmRestore" class="entry-callout" role="alert"><p>Restore the source definition in your Compendium? Existing characters keep their reviewed rules until you review them again.</p><p v-if="dirty">This will replace your unsaved draft.</p><button v-if="dirty" class="btn-ghost" @click="download">Download draft</button><button class="btn-ghost" :disabled="busy" @click="confirmRestore=false">Keep edition</button><button class="btn-ghost" :disabled="busy" @click="save(true)">Restore source definition</button></div>
    <details class="entry-field-group" @toggle="showSource=($event.target as HTMLDetailsElement).open"><summary>Compare with source</summary><div v-if="showSource" class="entry-review-body"><ReferenceValue :value="displayValue(state.source)" /></div></details>
    <section class="entry-review"><h3 class="font-display">Review existing characters</h3><p class="entry-hint">Compare each affected character before applying this saved edition. Current HP, spent uses, inventory quantities and player choices are preserved.</p><button type="button" class="btn-ghost" :disabled="dirty||busy||reviewBusy" @click="loadReview">{{reviewBusy?'Preparing review…':review?'Refresh character review':'Find affected characters'}}</button><p v-if="dirty" class="entry-hint">Save your entry changes before reviewing characters.</p><p v-if="reviewError" class="entry-error" role="alert">{{reviewError}}</p><p v-if="review&&!review.characters.length" role="status">No existing characters use this entry.</p>
    <details v-for="row in review?.characters??[]" :key="row.id" class="entry-field-group"><summary>{{row.name}} <small>{{applied[row.id]||row.alreadyReviewed?'Reviewed':'Review required'}}</small></summary><div class="entry-review-body"><p v-for="warning in row.warnings" :key="warning" class="entry-callout">{{warning}}</p><p v-if="!row.changes.length" class="entry-hint">No saved statistics need changing. Applying records this definition for the character’s reference rules.</p><div v-for="change in row.changes" :key="change.field" class="entry-review-change"><h4>{{change.field}}</h4><div class="entry-comparison"><section><h5>Current</h5><ReferenceValue :value="displayValue(change.before)" /></section><section><h5>Proposed</h5><ReferenceValue :value="displayValue(change.after)" /></section></div></div><label v-if="row.sourceConfirmation" class="entry-check"><input v-model="confirmed[row.id]" type="checkbox" :disabled="dirty||reviewBusy||!!applied[row.id]"/>This is the intended source for {{row.name}}.</label><button type="button" class="btn-primary" :disabled="dirty||busy||reviewBusy||!!applied[row.id]||row.alreadyReviewed||row.sourceConfirmation&&!confirmed[row.id]" @click="apply(row)">{{applied[row.id]?'Applied':`Apply reviewed rules to ${row.name}`}}</button></div></details>
    </section>
  </template>
</section></div></Teleport></template>
