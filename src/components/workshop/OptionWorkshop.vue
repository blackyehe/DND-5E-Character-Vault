<script setup lang="ts">
import {computed,defineAsyncComponent,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {onBeforeRouteLeave} from 'vue-router'
import {api} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import {OPTION_KINDS,newOptionDraft,restoreOptionDraft,optionDraftEntry,optionDraftStorageKey,optionTitle,type OptionDraft,type OptionKind} from '../../../shared/option-workshop'
import {optionCreationKind} from '../../../shared/option-kinds'
import type {OptionBuilder} from '../../../shared/entry-builders'
import type {EntryData} from '../../../shared/compendium-editing'
import DeleteCreationButton from './DeleteCreationButton.vue'
import WorkshopLibraryTools from './WorkshopLibraryTools.vue'
import {revealNavigationTarget} from '../../lib/navigation-scroll'
import {announceWorkshopChange} from '../../lib/workshop-trash'
const EntryBuilder=defineAsyncComponent(()=>import('../compendium/EntryBuilder.vue'))
const auth=useAuthStore(),key=computed(()=>optionDraftStorageKey(auth.user?.id??'local'))
type Pack={id:string;filename:string;hash:string}
const kind=ref<OptionKind>('feats'),draft=ref<OptionDraft|null>(null),drafts=ref<OptionDraft[]>([]),options=ref<OptionDraft[]>([]),packs=ref<Pack[]>([]),query=ref(''),target=ref('new'),filename=ref('My Character Options.orcbrew')
const loading=ref(false),busy=ref(false),error=ref(''),storageError=ref(''),notice=ref(''),warnings=ref<string[]>([]),storageReadable=ref(true)
const savePanel=ref<HTMLElement|null>(null)
function showSave(){savePanel.value?.focus({preventScroll:true});revealNavigationTarget(savePanel.value)}
let timer:ReturnType<typeof setTimeout>|undefined,loadNumber=0,accountGeneration=0
const matches=computed(()=>options.value.filter(d=>d.kind===kind.value&&`${d.body.name} ${d.source}`.toLowerCase().includes(query.value.toLowerCase())))
const deviceDrafts=computed(()=>drafts.value.filter(d=>d.kind===kind.value&&`${d.body.name} ${d.source}`.toLowerCase().includes(query.value.toLowerCase())))
function persist(){clearTimeout(timer);if(busy.value)return false;if(!draft.value)return true;if(!storageReadable.value)return false
 const copy=JSON.parse(JSON.stringify({...draft.value,updatedAt:new Date().toISOString()})) as OptionDraft,next=[copy,...drafts.value.filter(d=>d.id!==copy.id)]
 try{localStorage.setItem(key.value,JSON.stringify(next));drafts.value=next;storageError.value='';return true}catch{storageError.value='This browser could not save your draft. Keep this page open and download the draft before leaving.';return false}}
function readDrafts(){try{const saved=JSON.parse(localStorage.getItem(key.value)??'[]');if(!Array.isArray(saved))throw Error();drafts.value=saved.map(restoreOptionDraft);storageReadable.value=true;storageError.value=''}catch{storageReadable.value=false;storageError.value='Saved option drafts could not be read. Existing data has been kept; download an account backup before repairing browser storage.'}}
async function load(){const run=++loadNumber;loading.value=true;error.value='';try{const data=await api.get<{packs:Pack[];options:OptionDraft[];warnings:string[]}>('/api/workshop/options',{timeoutMs:60000});if(run!==loadNumber)return;packs.value=data.packs;options.value=data.options;warnings.value=data.warnings}catch(e){if(run===loadNumber)error.value=(e as Error).message}finally{if(run===loadNumber)loading.value=false}}
function open(value:OptionDraft){if(!persist())return;draft.value=JSON.parse(JSON.stringify(value));target.value=value.published?.packId??'new';notice.value='';error.value=''}
function back(){if(persist())draft.value=null}
function changed(entry:EntryData){if(!draft.value)return;if(entry.optionBuilder)draft.value.body=entry.optionBuilder as OptionBuilder;if(Array.isArray(entry.benefits))draft.value.benefits=entry.benefits}
function download(){if(!draft.value)return;const url=URL.createObjectURL(new Blob([JSON.stringify(draft.value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='character-option-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function publish(){if(!draft.value||!persist())return;const owner=auth.user?.id,generation=accountGeneration,pack=packs.value.find(p=>p.id===target.value);busy.value=true;error.value=''
 try{const result=await api.post<{draft:OptionDraft;message:string}>('/api/workshop/options/publish',{draft:draft.value,target:target.value==='new'?{filename:filename.value}:{packId:target.value,expectedHash:pack?.hash},expectedRevision:draft.value.published?.revision??0});if(owner!==auth.user?.id||generation!==accountGeneration)return;draft.value=result.draft;target.value=result.draft.published!.packId;notice.value=result.message;announceWorkshopChange();await load()}
 catch(e){if(owner===auth.user?.id&&generation===accountGeneration)error.value=(e as Error).message}
 finally{if(owner===auth.user?.id&&generation===accountGeneration){busy.value=false;persist()}}
}
async function refresh(){if(busy.value)return;readDrafts();await load()}
const canLeave=()=>!busy.value&&persist()
defineExpose({persist:canLeave})
onBeforeRouteLeave(canLeave)
function exit(e:BeforeUnloadEvent){if(!canLeave())e.preventDefault()}
watch(draft,()=>{clearTimeout(timer);if(draft.value&&!busy.value)timer=setTimeout(persist,450)},{deep:true})
watch(()=>auth.user?.id,()=>{++accountGeneration;clearTimeout(timer);++loadNumber;draft.value=null;drafts.value=[];options.value=[];packs.value=[];busy.value=false;notice.value='';readDrafts();void load()},{flush:'sync'})
onMounted(()=>{readDrafts();void load();window.addEventListener('beforeunload',exit)})
onBeforeUnmount(()=>{clearTimeout(timer);++loadNumber;persist();window.removeEventListener('beforeunload',exit)})
</script>
<template><section class="option-workshop" aria-label="Character option Workshop">
 <p v-if="storageError" class="hw-alert" role="alert">{{storageError}}</p><p v-if="error" class="hw-alert" role="alert">{{error}}</p><p v-if="notice" class="hw-callout" role="status">{{notice}}</p>
 <template v-if="draft"><div class="hw-draft-toolbar"><button type="button" class="hw-button" :disabled="busy" @click="back">Back to option library</button><div class="hw-actions" aria-label="Save current character option"><button type="button" class="hw-button" :disabled="busy" @click="persist()&&(notice='Draft saved on this device.')">Save draft</button><button type="button" class="hw-button hw-button-primary" :disabled="busy" @click="showSave">Save to pack…</button></div><p class="hw-hint">Save draft keeps this work on this device. Save to pack makes it available to your characters.</p></div><div class="hw-export-actions"><button type="button" class="hw-text-button" @click="download">Download draft</button><button type="button" class="hw-text-button" :disabled="busy||loading" @click="refresh">Reload library</button></div>
  <fieldset :disabled="busy"><label>Source / collection<input v-model="draft.source" maxlength="200" /></label><EntryBuilder :key="draft.id" :model-value="optionDraftEntry(draft)" :kind="draft.kind" @update:model-value="changed" />
  <section ref="savePanel" tabindex="-1" class="hw-panel option-save-panel" aria-label="Save character option"><h3>Save {{optionTitle(draft.kind)}} to pack</h3><p class="hw-hint">Saving makes this option available in your Compendium and character choices. Existing characters keep their reviewed rules. Prerequisites and equipment notes need your review.</p>
   <label>Destination pack<select v-model="target" :disabled="!!draft.published"><option v-if="!draft.published" value="new">New pack</option><option v-if="draft.published&&!packs.some(p=>p.id===draft!.published!.packId)" :value="draft.published.packId">Original pack unavailable</option><option v-for="pack in packs" :key="pack.id" :value="pack.id">{{pack.filename}}</option></select></label>
   <label v-if="target==='new'">New pack filename<input v-model="filename" maxlength="255" /></label>
   <button type="button" class="hw-button hw-button-primary" :disabled="busy||!storageReadable||!draft.body.name.trim()||!draft.source.trim()||target==='new'&&!filename.trim()||target!=='new'&&!packs.some(p=>p.id===target)" @click="publish">{{busy?'Saving…':`Save ${optionTitle(draft.kind)} to pack`}}</button>
  </section></fieldset>
 </template>
 <template v-else><WorkshopLibraryTools title="Character options" description="Create feats, backgrounds, granted options, languages and reference entries."><template #search><label>Find options<input v-model="query" type="search" placeholder="Search by name or source…" /></label></template><template #actions><button type="button" class="hw-button hw-button-primary" :disabled="!storageReadable" @click="open(newOptionDraft(kind))">+ New {{optionTitle(kind)}}</button></template><template #filters><div class="hw-actions" role="group" aria-label="Option type"><button v-for="category in OPTION_KINDS" :key="category" type="button" class="hw-button" :aria-pressed="kind===category" @click="kind=category">{{({selections:'Choice groups',other:'Reference entries'} as Record<string,string>)[category]??category.charAt(0).toUpperCase()+category.slice(1)}}</button></div></template><template #utility><button type="button" class="hw-text-button" :disabled="busy||loading" @click="refresh">Reload library</button></template></WorkshopLibraryTools>
  <p v-if="loading" class="hw-hint" role="status">Loading saved options… Device drafts remain available.</p>
  <section v-if="deviceDrafts.length" class="hw-library-section"><h3>Your device drafts</h3><div class="hw-library-grid"><article v-for="item in deviceDrafts" :key="item.id" class="hw-creation-card"><button type="button" class="hw-content-card" @click="open(item)"><strong>{{item.body.name||`Untitled ${optionTitle(item.kind)}`}}</strong><small>{{item.source}}</small><span class="hw-content-footer">This device <b>Continue draft</b></span></button><DeleteCreationButton :target="{scope:'draft',id:item.id,name:item.body.name||'Untitled option',storageKey:key}" label="Delete draft" @deleted="refresh" /></article></div></section>
  <section class="hw-library-section"><h3>Saved in your packs</h3><p v-if="!loading&&!matches.length" class="hw-empty-inline">No saved {{kind}} match. Start a new {{optionTitle(kind)}} above. Imported options remain available in the Compendium.</p><div class="hw-library-grid"><article v-for="item in matches" :key="item.id+item.published?.packId" class="hw-creation-card"><button type="button" class="hw-content-card" @click="open(item)"><strong>{{item.body.name}}</strong><small>{{item.source}}</small><span class="hw-content-footer">Revision {{item.published?.revision}} <b>Open draft</b></span></button><DeleteCreationButton v-if="item.published" :target="{scope:'pack',index:item.published.index,kind:optionCreationKind(item.kind),name:item.body.name,packs:packs.filter(p=>p.id===item.published?.packId)}" @deleted="refresh" /></article></div></section>
 </template><p v-for="warning in warnings" :key="warning" class="hw-alert">{{warning}}</p>
</section></template>
<style scoped>
.option-workshop{display:grid;gap:24px}.option-workshop fieldset{border:0;padding:0;min-width:0}.option-save-panel{display:grid;gap:16px;padding:24px;scroll-margin-top:88px}.option-workshop :deep(.entry-builder){padding:16px 0 24px}
</style>
