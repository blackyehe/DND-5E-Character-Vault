<script setup lang="ts">
import { nextTick, computed, onMounted, onUnmounted, ref, watch, defineAsyncComponent } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { vMotionPanel } from '../directives/siteMotion'
import { revealNavigationTarget } from '../lib/navigation-scroll'
import { useAuthStore } from '../stores/auth'
import { contentLabel, srd, type SrdRef } from '../lib/srd'
import {loadWorkshopStartup} from '../lib/workshop-startup'
import { newWorkshopDraft, restoreWorkshopDraft, workshopFromEntry, WORKSHOP_STEPS, type WorkshopDraft, type WorkshopStep } from '../lib/homebrew-workshop'
import type { AbilityKey } from '../lib/calc'
import WorkshopEditor from '../components/workshop/WorkshopEditor.vue'
import WorkshopPreview from '../components/workshop/WorkshopPreview.vue'
import '../components/workshop/workshop.css'
import { api } from '../lib/api'
import WorkshopPublish, {type WorkshopLibraryInfo} from '../components/workshop/WorkshopPublish.vue'
import ItemWorkshop from '../components/items/ItemWorkshop.vue'
import DeleteCreationButton from '../components/workshop/DeleteCreationButton.vue'
import WorkshopTrash from '../components/workshop/WorkshopTrash.vue'
import WorkshopLibraryTools from '../components/workshop/WorkshopLibraryTools.vue'
import { captureBackupDevice,backupDownloadSize } from "../lib/account-backup"
const workshopArea=ref('rules')
const CompendiumEntries=defineAsyncComponent(()=>import('./CompendiumView.vue'))
const MonsterWorkshop=defineAsyncComponent(()=>import('../components/monsters/MonsterWorkshop.vue'))
const OptionWorkshop=defineAsyncComponent(()=>import('../components/workshop/OptionWorkshop.vue'))
const optionWorkshop=ref<{persist:()=>boolean}|null>(null)
const monsterWorkshop=ref<{persist:()=>boolean}|null>(null)
function chooseArea(value:string){if(workshopArea.value==='options'&&!optionWorkshop.value?.persist())return;if(workshopArea.value==='monsters'&&!monsterWorkshop.value?.persist())return;if(!persist())return;workshopArea.value=value}

const auth=useAuthStore()
const storageKey=`codex:homebrew-workshop:v1:${auth.user?.id??'local'}`
const drafts=ref<WorkshopDraft[]>([])
const draft=ref<WorkshopDraft|null>(null)
const step=ref<WorkshopStep>('identity')
const query=ref(''),kind=ref<WorkshopDraft['kind']>('class')
const entries=ref<(SrdRef & {kind:WorkshopDraft['kind']})[]>([])
const classes=ref<SrdRef[]>([]),spells=ref<(SrdRef & {level?:number})[]>([])
const loading=ref(true),loadError=ref(''),storageError=ref(''),saveStatus=ref('')
const libraryInfo=ref<WorkshopLibraryInfo>({packs:[],rules:[],warnings:[]})
const publishOpen=ref(false),exportBusy=ref(false),exportError=ref(''),exportNote=ref('')
const level=ref(6)
const scores=ref<Record<AbilityKey,number>>({str:16,dex:16,con:18,int:16,wis:16,cha:16})
const matches=computed(()=>entries.value.filter(e=>e.kind===kind.value&&`${e.name} ${e.sourcePack??''}`.toLowerCase().includes(query.value.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)))
const draftMatches=computed(()=>drafts.value.filter(d=>d.kind===kind.value&&`${d.name} ${d.source}`.toLowerCase().includes(query.value.toLowerCase())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)))
watch(draft,()=>{saveStatus.value=''}, {deep:true})
function persist(showStatus=false) {
  if(!draft.value)return true
  const copy=JSON.parse(JSON.stringify({...draft.value,updatedAt:new Date().toISOString()})) as WorkshopDraft
  const next=[copy,...drafts.value.filter(d=>(d.localId??d.id)!==(copy.localId??copy.id))]
  try {localStorage.setItem(storageKey,JSON.stringify(next));drafts.value=next;storageError.value='';if(showStatus)saveStatus.value='Draft saved on this device.';return true}
  catch {storageError.value='This browser could not save the draft. Keep this page open and free some browser storage before trying again.';return false}
}
function open(value:WorkshopDraft){draft.value=restoreWorkshopDraft(value);step.value='identity';saveStatus.value='';void nextTick(()=>revealNavigationTarget(document.querySelector('.hw-workspace')))}
function openImported(entry:SrdRef & {kind:WorkshopDraft['kind']}) {
  const existing=drafts.value.find(d=>d.imported?.index===entry.index&&d.kind===entry.kind)
  const value=existing??workshopFromEntry(entry as unknown as Record<string,unknown>,entry.kind)
  if(!existing&&drafts.value.some(d=>d.id===value.id&&d.imported?.index!==entry.index))value.localId=crypto.randomUUID()
  if(!existing){
    if(value.race)for(const spell of value.race.spells){const candidates=spells.value.filter(s=>s.index===spell.index||s.contentKey===spell.index||s.aliases?.includes(spell.index));if(candidates.length===1){spell.index=candidates[0]!.index;spell.name=candidates[0]!.name}}
    const savedRule=libraryInfo.value.rules.find(r=>r.id===value.id&&r.index===entry.index),pack=libraryInfo.value.packs.find(p=>p.entries.includes(entry.index))
    if(savedRule&&savedRule.revision>0&&pack)value.published={revision:savedRule.revision,index:entry.index,packId:pack.id,packHash:pack.hash}
    value.magic.spellList=value.magic.spellList.map(key=>{
      const candidates=spells.value.filter(s=>s.index===key||s.contentKey===key||s.aliases?.includes(key))
      const sameSource=candidates.filter(s=>s.sourcePack===value.source)
      return sameSource.length===1?sameSource[0]!.index:candidates.length===1?candidates[0]!.index:key
    })
    const parents=classes.value.filter(c=>c.index===value.parentClass||c.contentKey===value.parentClass)
    if(parents.length===1)value.parentClass=parents[0]!.index
  }
  const parentRule=libraryInfo.value.rules.find(r=>r.index===value.parentClass||r.previousIndexes?.includes(value.parentClass));if(parentRule)value.parentClass=parentRule.index
  open(value)
}
function back(){if(persist()){draft.value=null;saveStatus.value=''}}
async function removed(message:string){drafts.value=JSON.parse(localStorage.getItem(storageKey)??'[]');await loadLibrary();saveStatus.value=message}
function rulePacks(index:string){return libraryInfo.value.packs.filter(p=>p.entries.includes(index))}
onBeforeRouteLeave(()=>persist())
const saveOnExit=(event:BeforeUnloadEvent)=>{if(!persist())event.preventDefault()}
onMounted(()=>window.addEventListener('beforeunload',saveOnExit))
onUnmounted(()=>window.removeEventListener('beforeunload',saveOnExit))
onMounted(async()=>{
  try {const saved=JSON.parse(localStorage.getItem(storageKey)??'[]');if(Array.isArray(saved))drafts.value=saved.filter(d=>d?.version===1&&typeof d.id==='string'&&Array.isArray(d.features)&&Array.isArray(d.resources)&&d.magic)}
  catch {storageError.value='Saved drafts could not be read. Your existing browser data has been kept.'}
  await loadLibrary()
})
async function loadLibrary(){
  loading.value=true;loadError.value=''
  const imported=loadWorkshopStartup()
  const results=await Promise.allSettled([imported.then(v=>v.classes),imported.then(v=>v.subclasses),imported.then(v=>v.spells),srd.classes(),srd.spells(),imported.then(v=>v.library),imported.then(v=>v.races)])
  const [klass,subclass,spell,coreClass,coreSpell,info,races]=results
  entries.value=[];classes.value=[];spells.value=[]
  if(klass?.status==='fulfilled'){entries.value.push(...klass.value.map(e=>({...e,kind:'class' as const})));classes.value.push(...klass.value)}
  if(races?.status==='fulfilled')entries.value.push(...races.value.map(e=>({...e,kind:'race' as const})))
  if(subclass?.status==='fulfilled')entries.value.push(...subclass.value.map(e=>({...e,kind:'subclass' as const})))
  if(spell?.status==='fulfilled')spells.value.push(...spell.value)
  if(coreClass?.status==='fulfilled')classes.value.unshift(...coreClass.value)
  if(coreSpell?.status==='fulfilled')spells.value.unshift(...coreSpell.value)
  if(info?.status==='fulfilled')libraryInfo.value=info.value
  if(results.some(r=>r.status==='rejected'))loadError.value='Part of the content library could not be loaded. Drafts remain available. Reload the library to retry.'
  loading.value=false
}
async function published(value:WorkshopDraft,message:string){value.localId=draft.value?.localId??draft.value?.id;draft.value=value;publishOpen.value=false;persist();await loadLibrary();await nextTick();saveStatus.value=message}
function download(filename:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportDraft(){if(!draft.value||exportBusy.value)return;exportBusy.value=true;exportError.value='';try{const result=await api.post<{filename:string;source:string;warnings:string[]}>('/api/workshop/export',{draft:draft.value});download(result.filename,result.source,'application/octet-stream');exportNote.value=result.warnings.join(' ')}catch(e){exportError.value=(e as Error).message}finally{exportBusy.value=false}}
async function backup(){if(exportBusy.value||workshopArea.value==='options'&&!optionWorkshop.value?.persist()||workshopArea.value==='monsters'&&!monsterWorkshop.value?.persist())return;if(!persist())return;exportBusy.value=true;exportError.value='';try{const device=captureBackupDevice(auth.user?.id??'local'),data=await api.get<Record<string,unknown>>('/api/workshop/backup',{timeoutMs:120000});data.device=device;backupDownloadSize(data);download('codex-of-heroes-backup.json',JSON.stringify(data),'application/json');exportNote.value='Backup downloaded: characters, libraries, folders, owned campaigns, Notebook history, Maps, city libraries and device drafts. Restored rooms require fresh player invitations.'}catch(e){exportError.value=(e as Error).message}finally{exportBusy.value=false}}
</script>

<template><div v-stable-loading="loading" class="hw-page">
  <header class="hw-page-header"><div><p class="hw-eyebrow">YOUR RULES. YOUR WORLD.</p><h1>Homebrew Workshop <span class="hw-pill">Rules, character options, items & monsters</span></h1><p class="hw-hint">Create rules and items, with their effects visible as you work.</p></div><button type="button" class="hw-button" :disabled="exportBusy" @click="backup">Download site backup</button></header>
  <nav class="hw-category-nav" aria-label="Workshop content sections"><button class="hw-button" :class="{'hw-button-primary':workshopArea==='rules'}" :aria-pressed="workshopArea==='rules'" @click="chooseArea('rules')">Classes, subclasses &amp; races</button><button class="hw-button" :class="{'hw-button-primary':workshopArea==='options'}" :aria-pressed="workshopArea==='options'" @click="chooseArea('options')">Character options</button><button class="hw-button" :class="{'hw-button-primary':workshopArea==='items'}" :aria-pressed="workshopArea==='items'" @click="chooseArea('items')">Normal &amp; magic items</button><button class="hw-button" :class="{'hw-button-primary':workshopArea==='monsters'}" :aria-pressed="workshopArea==='monsters'" @click="chooseArea('monsters')">Monsters &amp; actions</button><button class="hw-button" :class="{'hw-button-primary':workshopArea==='compendium'}" :aria-pressed="workshopArea==='compendium'" @click="chooseArea('compendium')">All Compendium entries</button><button class="hw-button" :class="{'hw-button-primary':workshopArea==='trash'}" :aria-pressed="workshopArea==='trash'" @click="chooseArea('trash')">Recently deleted</button></nav><p v-if="exportError" class="hw-alert" role="alert">{{exportError}}</p><p v-if="exportNote" class="hw-callout" role="status">{{exportNote}}</p><div v-motion-panel="workshopArea" class="hw-area-content"><CompendiumEntries v-if="workshopArea==='compendium'" embedded /><OptionWorkshop v-else-if="workshopArea==='options'" ref="optionWorkshop"/><WorkshopTrash v-else-if="workshopArea==='trash'" @changed="removed('Creation restored.')"/><ItemWorkshop v-else-if="workshopArea==='items'" /><MonsterWorkshop v-else-if="workshopArea==='monsters'" ref="monsterWorkshop"/><template v-else><p v-if="storageError" class="hw-alert" role="alert">{{storageError}}</p><p v-if="saveStatus" class="hw-save-status" role="status">{{saveStatus}}</p><p v-if="loadError" class="hw-alert" role="status">{{loadError}}</p>
  <div v-if="draft" class="hw-draft-toolbar"><button type="button" class="hw-button" @click="back">Back to library</button><div class="hw-actions" aria-label="Save current creation"><button type="button" class="hw-button" @click="persist(true)">Save draft</button><button type="button" class="hw-button hw-button-primary" @click="step='review';publishOpen=true">Save to pack…</button></div><p class="hw-hint">Save draft keeps this work on this device. Save to pack makes the rules available to your characters.</p></div>
  <div v-if="draft" class="hw-export-actions"><button class="hw-text-button" :disabled="exportBusy" @click="exportDraft">{{exportBusy?'Preparing download…':'Export this definition as Orcbrew ↓'}}</button><span v-if="draft.published" class="hw-pill">Saved revision {{draft.published.revision}}</span></div>
  <div v-if="draft" class="hw-workspace"><nav class="hw-step-nav" aria-label="Workshop sections"><div class="hw-draft-title"><span class="hw-eyebrow">{{draft.kind}} DRAFT</span><strong>{{draft.name||'Untitled creation'}}</strong></div><button v-for="(section,index) in WORKSHOP_STEPS" :key="section.key" type="button" :class="{active:step===section.key}" :aria-current="step===section.key?'step':undefined" @click="step=section.key"><span class="hw-step-number">{{index+1}}</span><span><strong>{{draft.kind==='race'?({foundation:'Body & training',progression:'Trait progression',magic:'Innate spells',features:'Traits & choices'} as Record<string,string>)[section.key]??section.name:section.name}}</strong><small>{{draft.kind==='race'?(section.key==='foundation'?'Speed, size, bonuses & training':section.key==='magic'?'Racial spell grants & casting rules':section.key==='identity'?'Name, source & lore':'Rules by character level'):section.hint}}</small></span></button><p class="hw-nav-note">Drafts save on this device when you leave the editor. Save to a pack when you’re ready to apply these rules.</p></nav><WorkshopEditor :draft="draft" :step="step" :classes="classes" :spells="spells" @step="step=$event" @save="persist(true)" @publish="publishOpen=true"/><WorkshopPreview :draft="draft" :step="step" :level="level" :scores="scores" @level="level=$event" @score="(key,value)=>scores[key]=value"/></div>
  <div v-else v-motion-panel="kind" class="hw-library"><WorkshopLibraryTools title="Classes, subclasses & races" description="Build rules, preview their progression, then save them to a pack for your characters.">
    <template #search><label>Find content<input v-model="query" type="search" placeholder="Search by name or source…"/></label></template>
    <template #actions><button type="button" class="hw-button hw-button-primary" @click="open(newWorkshopDraft(kind))">+ New {{kind}}</button></template>
    <template #filters><div class="hw-actions" role="group" aria-label="Content type"><button v-for="category in (['class','subclass','race'] as const)" :key="category" type="button" class="hw-button" :aria-pressed="kind===category" @click="kind=category">{{category==='class'?'Classes':category==='subclass'?'Subclasses':'Races'}}</button></div></template>
    <template #utility><button type="button" class="hw-text-button" :disabled="loading" @click="loadLibrary">Reload library</button></template>
  </WorkshopLibraryTools>
  <section v-if="libraryInfo.packs.length" class="hw-panel hw-pack-list"><h2>Your packs</h2><div v-for="pack in libraryInfo.packs" :key="pack.id" class="hw-between"><span>{{pack.filename}}</span><a class="hw-text-button" :href="`/api/content/orcbrew-packs/${pack.id}/export`" download>Export Orcbrew ↓</a></div></section><section v-if="draftMatches.length" class="hw-library-section"><div class="hw-between"><h2>Your drafts</h2><span class="hw-hint">Saved on this device</span></div><div class="hw-library-grid"><article v-for="item in draftMatches" :key="item.localId??item.id" class="hw-creation-card"><button class="hw-content-card" @click="open(item)"><span class="hw-card-kind">{{item.kind}} · Draft</span><strong>{{item.name||'Untitled creation'}}</strong><small>{{item.source}}</small><span class="hw-content-footer">{{item.features.length}} features · {{item.resources.length}} trackers <b>Continue →</b></span></button><DeleteCreationButton :target="{scope:'draft',id:item.localId??item.id,name:item.name||'Untitled creation',storageKey}" label="Delete draft" @deleted="removed"/></article></div></section>
  <section class="hw-library-section"><div class="hw-between"><h2>In your packs <span class="hw-pill">{{matches.length}}</span></h2><span class="hw-hint">Open a definition to edit its rules</span></div><p v-if="loading" role="status" class="hw-empty-inline">Loading your content library…</p><p v-else-if="!matches.length" class="hw-empty-inline">No {{kind==='race'?'races':kind==='class'?'classes':'subclasses'}} match. Create something new, or import an Orcbrew pack in the Compendium.</p><div v-else class="hw-library-grid"><article v-for="entry in matches" :key="entry.index" class="hw-creation-card"><button class="hw-content-card" @click="openImported(entry)"><span class="hw-card-kind">{{entry.kind}} · {{entry.workshop?`SAVED · REVISION ${entry.workshopRevision??1}`:'IMPORTED'}}</span><strong>{{contentLabel(entry)}}</strong><small>{{entry.sourcePack||'Imported collection'}}</small><span class="hw-content-footer">{{entry.workshop?'Linked character rules':'Preserved original rules'}} <b>Open draft →</b></span></button><DeleteCreationButton v-if="entry.workshop && rulePacks(entry.index).length" :target="{scope:'pack',index:entry.index,kind:entry.kind,name:entry.name,packs:rulePacks(entry.index)}" @deleted="removed"/></article></div></section></div>
<WorkshopPublish v-if="publishOpen&&draft" :draft="draft" @close="publishOpen=false" @saved="published"/></template></div></div></template>
