<script setup lang="ts">
import {computed,defineAsyncComponent,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {onBeforeRouteLeave} from 'vue-router'
import {api} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import {newSpellDraft,restoreSpellDraft,spellDraftEntry,spellDraftStorageKey,type SpellDraft} from '../../../shared/spell-workshop'
import type {SpellBuilder} from '../../../shared/entry-builders'
import type {EntryData} from '../../../shared/compendium-editing'
import DeleteCreationButton from './DeleteCreationButton.vue'
import WorkshopLibraryTools from './WorkshopLibraryTools.vue'
import {revealNavigationTarget} from '../../lib/navigation-scroll'
import {announceWorkshopChange} from '../../lib/workshop-trash'
import {sameEntry} from '../../../shared/compendium-editing'
import {benefitProblems} from '../../../shared/rule-benefits'
import DefinitionChangeReview from '../compendium/DefinitionChangeReview.vue'
const EntryBuilder=defineAsyncComponent(()=>import('../compendium/EntryBuilder.vue'))
const auth=useAuthStore(),key=computed(()=>spellDraftStorageKey(auth.user?.id??'local'))
type Pack={id:string;filename:string;hash:string}
const draft=ref<SpellDraft|null>(null),drafts=ref<SpellDraft[]>([]),spells=ref<SpellDraft[]>([]),packs=ref<Pack[]>([]),query=ref(''),target=ref('new'),filename=ref('My Spells.orcbrew')
const loading=ref(false),busy=ref(false),error=ref(''),storageError=ref(''),notice=ref(''),warnings=ref<string[]>([]),storageReadable=ref(true)
const reviewBusy=ref(false)
const characterReview=ref<InstanceType<typeof DefinitionChangeReview>|null>(null)
const savedDraft=computed(()=>spells.value.find(d=>d.id===draft.value?.id))
const reviewSaved=computed(()=>!!draft.value?.published&&!!savedDraft.value&&sameEntry([draft.value.body,draft.value.benefits,draft.value.source],[savedDraft.value.body,savedDraft.value.benefits,savedDraft.value.source]))
const saveProblem=computed(()=>{
 if(!draft.value)return 'Open an spell first.'
 if(!storageReadable.value)return 'Repair browser draft storage before saving. Download a backup first.'
 if(!draft.value.body.name.trim())return 'Enter an spell name before saving.'
 if(!draft.value.source.trim())return 'Enter a source or collection before saving.'
 if(target.value==='new'&&!/^[^<>:"/\\|?*\x00-\x1f]+\.orcbrew$/i.test(filename.value.trim()))return 'Enter a valid pack filename ending in .orcbrew.'
 if(target.value!=='new'&&!packs.value.some(p=>p.id===target.value))return loading.value?'Loading destination packs…':'The original pack is unavailable. Reload the library or restore its pack; your draft is kept.'
 return benefitProblems(draft.value.benefits)[0]??''
})
const savePanel=ref<HTMLElement|null>(null)
function showSave(){savePanel.value?.focus({preventScroll:true});revealNavigationTarget(savePanel.value)}
let timer:ReturnType<typeof setTimeout>|undefined,loadNumber=0,accountGeneration=0
const matches=computed(()=>spells.value.filter(d=>`${d.body.name} ${d.source}`.toLowerCase().includes(query.value.toLowerCase())))
const deviceDrafts=computed(()=>drafts.value.filter(d=>`${d.body.name} ${d.source}`.toLowerCase().includes(query.value.toLowerCase())))
function persist(){clearTimeout(timer);if(busy.value)return false;if(!draft.value)return true;if(!storageReadable.value)return false
 const copy=JSON.parse(JSON.stringify({...draft.value,updatedAt:new Date().toISOString()})) as SpellDraft,next=[copy,...drafts.value.filter(d=>d.id!==copy.id)]
 try{localStorage.setItem(key.value,JSON.stringify(next));drafts.value=next;storageError.value='';return true}catch{storageError.value='This browser could not save your draft. Keep this page open and download the draft before leaving.';return false}}
function readDrafts(){try{const saved=JSON.parse(localStorage.getItem(key.value)??'[]');if(!Array.isArray(saved))throw Error();drafts.value=saved.map(restoreSpellDraft);storageReadable.value=true;storageError.value=''}catch{storageReadable.value=false;storageError.value='Saved spell drafts could not be read. Existing data has been kept; download an account backup before repairing browser storage.'}}
async function load(){const run=++loadNumber;loading.value=true;error.value='';try{const data=await api.get<{packs:Pack[];spells:SpellDraft[];warnings:string[]}>('/api/workshop/spells',{timeoutMs:60000});if(run!==loadNumber)return;packs.value=data.packs;spells.value=data.spells;warnings.value=data.warnings}catch(e){if(run===loadNumber)error.value=(e as Error).message}finally{if(run===loadNumber)loading.value=false}}
function open(value:SpellDraft){if(!persist())return;draft.value=JSON.parse(JSON.stringify(value));target.value=value.published?.packId??'new';notice.value='';error.value=''}
function back(){if(!reviewBusy.value&&persist())draft.value=null}
function changed(entry:EntryData){if(!draft.value)return;if(entry.spellBuilder)draft.value.body=entry.spellBuilder as SpellBuilder;if(Array.isArray(entry.benefits))draft.value.benefits=entry.benefits}
function download(){if(!draft.value)return;const url=URL.createObjectURL(new Blob([JSON.stringify(draft.value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='spell-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function publish(){if(busy.value||reviewBusy.value||!draft.value||saveProblem.value||!persist())return;const owner=auth.user?.id,generation=accountGeneration,pack=packs.value.find(p=>p.id===target.value),packFilename=filename.value.trim();busy.value=true;error.value=''
 try{const result=await api.post<{draft:SpellDraft;message:string;pack?:Pack}>('/api/workshop/spells/publish',{draft:draft.value,target:target.value==='new'?{filename:packFilename}:{packId:target.value,expectedHash:pack?.hash},expectedRevision:draft.value.published?.revision??0});if(owner!==auth.user?.id||generation!==accountGeneration)return;++loadNumber;loading.value=false;draft.value=result.draft;const published=result.draft.published!;target.value=published.packId;spells.value=[JSON.parse(JSON.stringify(result.draft)),...spells.value.filter(d=>d.id!==result.draft.id)];const savedPack=result.pack??{id:published.packId,filename:pack?.filename??packFilename,hash:published.packHash};packs.value=[savedPack,...packs.value.filter(p=>p.id!==savedPack.id)];notice.value=result.message;announceWorkshopChange()}
 catch(e){if(owner===auth.user?.id&&generation===accountGeneration)error.value=(e as Error).message}
 finally{if(owner===auth.user?.id&&generation===accountGeneration){busy.value=false;persist()}}
}
async function refresh(){if(busy.value||reviewBusy.value)return;readDrafts();await load()}
const canLeave=()=>!busy.value&&!reviewBusy.value&&persist()
defineExpose({persist:canLeave})
onBeforeRouteLeave(canLeave)
function exit(e:BeforeUnloadEvent){if(!canLeave())e.preventDefault()}
watch(draft,()=>{clearTimeout(timer);if(draft.value&&!busy.value)timer=setTimeout(persist,450)},{deep:true})
watch(()=>auth.user?.id,()=>{++accountGeneration;clearTimeout(timer);++loadNumber;draft.value=null;drafts.value=[];spells.value=[];packs.value=[];busy.value=false;notice.value='';readDrafts();void load()},{flush:'sync'})
onMounted(()=>{readDrafts();void load();window.addEventListener('beforeunload',exit)})
onBeforeUnmount(()=>{clearTimeout(timer);++loadNumber;++accountGeneration;persist();window.removeEventListener('beforeunload',exit)})
</script>
<template><section class="spell-workshop" aria-label="Spell Workshop">
 <p v-if="storageError" class="hw-alert" role="alert">{{storageError}}</p><p v-if="error" class="hw-alert" role="alert">{{error}}</p><p v-if="notice" class="hw-callout" role="status">{{notice}}</p>
 <template v-if="draft"><div class="hw-draft-toolbar"><button type="button" class="hw-button" :disabled="busy||reviewBusy" @click="back">Back to spell library</button><div class="hw-actions" aria-label="Save current spell"><button type="button" class="hw-button" :disabled="busy||reviewBusy" @click="persist()&&(notice='Draft saved on this device.')">Save draft</button><button type="button" class="hw-button hw-button-primary" :disabled="busy||reviewBusy" @click="showSave">Save to pack…</button></div><p class="hw-hint">Save draft keeps this work on this device. Save to pack makes it available to your characters.</p></div><div class="hw-export-actions"><button type="button" class="hw-text-button" @click="download">Download draft</button><button type="button" class="hw-text-button" :disabled="busy||reviewBusy||loading" @click="refresh">Reload library</button></div>
  <fieldset :disabled="busy||reviewBusy"><label>Source / collection<input v-model="draft.source" maxlength="200" /></label><EntryBuilder :key="draft.id" :model-value="spellDraftEntry(draft)" :kind="draft.kind" @update:model-value="changed" />
  <section ref="savePanel" tabindex="-1" class="hw-panel spell-save-panel" aria-label="Save spell"><h3>Save spell to pack</h3><p class="hw-hint">Saving makes this spell available in your Compendium and character choices. Existing characters keep their reviewed rules until you review and apply the saved spell below.</p>
   <label>Destination pack<select v-model="target" :disabled="!!draft.published"><option v-if="!draft.published" value="new">New pack</option><option v-if="draft.published&&!packs.some(p=>p.id===draft!.published!.packId)" :value="draft.published.packId">Original pack unavailable</option><option v-for="pack in packs" :key="pack.id" :value="pack.id">{{pack.filename}}</option></select></label>
   <label v-if="target==='new'">New pack filename<input v-model="filename" maxlength="255" /></label>
   <div class="hw-actions"><button type="button" class="hw-button hw-button-primary" :disabled="busy||reviewBusy||!!saveProblem" :aria-describedby="saveProblem?'spell-save-problem':undefined" @click="publish">{{busy?'Saving…':`Save ${'spell'} to pack`}}</button><button v-if="draft.published" type="button" class="hw-button" :disabled="busy||reviewBusy||!reviewSaved" @click="characterReview?.open()">Update existing characters</button></div><p v-if="draft.published&&!reviewSaved" class="hw-hint">Save your changes before updating existing characters.</p>
   <p v-if="saveProblem" id="spell-save-problem" class="hw-hint" role="status">{{saveProblem}}</p>
  </section></fieldset>
  <DefinitionChangeReview v-if="draft.published" ref="characterReview" :kind="draft.kind" :index="draft.published.index" :source-name="draft.body.name" :version="draft.published.revision" :disabled="busy||!reviewSaved" hide-trigger @busy="reviewBusy=$event" />
 </template>
 <template v-else><WorkshopLibraryTools title="Spells" description="Create spells using the same casting, effects and Benefits editor as the Compendium."><template #search><label>Find spells<input v-model="query" type="search" placeholder="Search by name or source…" /></label></template><template #actions><button type="button" class="hw-button hw-button-primary" :disabled="!storageReadable" @click="open(newSpellDraft())">+ New spell</button></template><template #utility><button type="button" class="hw-text-button" :disabled="busy||reviewBusy||loading" @click="refresh">Reload library</button></template></WorkshopLibraryTools>
  <p v-if="loading" class="hw-hint" role="status">Loading saved spells… Device drafts remain available.</p>
  <section v-if="deviceDrafts.length" class="hw-library-section"><h3>Your device drafts</h3><div class="hw-library-grid"><article v-for="item in deviceDrafts" :key="item.id" class="hw-creation-card"><button type="button" class="hw-content-card" @click="open(item)"><strong>{{item.body.name||'Untitled spell'}}</strong><small>{{item.source}}</small><span class="hw-content-footer">This device <b>Continue draft</b></span></button><DeleteCreationButton :target="{scope:'draft',id:item.id,name:item.body.name||'Untitled spell',storageKey:key}" label="Delete draft" @deleted="refresh" /></article></div></section>
  <section class="hw-library-section"><h3>Saved in your packs</h3><p v-if="!loading&&!matches.length" class="hw-empty-inline">No saved spells match. Start a new spell above. Imported spells remain available in the Compendium.</p><div class="hw-library-grid"><article v-for="item in matches" :key="item.id+item.published?.packId" class="hw-creation-card"><button type="button" class="hw-content-card" @click="open(item)"><strong>{{item.body.name}}</strong><small>{{item.source}}</small><span class="hw-content-footer">Revision {{item.published?.revision}} <b>Open draft</b></span></button><DeleteCreationButton v-if="item.published" :target="{scope:'pack',index:item.published.index,kind:'spell',name:item.body.name,packs:packs.filter(p=>p.id===item.published?.packId)}" @deleted="refresh" /></article></div></section>
 </template><p v-for="warning in warnings" :key="warning" class="hw-alert">{{warning}}</p>
</section></template>
<style scoped>
.spell-workshop{display:grid;gap:24px}.spell-workshop fieldset{border:0;padding:0;min-width:0}.spell-save-panel{display:grid;gap:16px;padding:24px;scroll-margin-top:88px}.spell-workshop :deep(.entry-builder){padding:16px 0 24px}
</style>
