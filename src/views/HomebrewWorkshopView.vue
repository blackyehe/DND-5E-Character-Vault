<script setup lang="ts">
import { nextTick, computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { contentLabel, homebrew, srd, type SrdRef } from '../lib/srd'
import { newWorkshopDraft, restoreWorkshopDraft, workshopFromEntry, WORKSHOP_STEPS, type WorkshopDraft, type WorkshopStep } from '../lib/homebrew-workshop'
import type { AbilityKey } from '../lib/calc'
import WorkshopEditor from '../components/workshop/WorkshopEditor.vue'
import WorkshopPreview from '../components/workshop/WorkshopPreview.vue'
import '../components/workshop/workshop.css'
import { api } from '../lib/api'
import WorkshopPublish, {type WorkshopLibraryInfo} from '../components/workshop/WorkshopPublish.vue'
import ItemWorkshop from '../components/items/ItemWorkshop.vue'
const workshopArea=ref('rules')

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
function open(value:WorkshopDraft){draft.value=restoreWorkshopDraft(value);step.value='identity';saveStatus.value='';window.scrollTo({top:0})}
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
  const results=await Promise.allSettled([homebrew.classes(),homebrew.subclasses(),homebrew.spells(),srd.classes(),srd.spells(),api.get<WorkshopLibraryInfo>('/api/workshop/library'),homebrew.races()])
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
async function backup(){if(exportBusy.value)return;if(!persist())return;exportBusy.value=true;exportError.value='';try{const data=await api.get<Record<string,unknown>>('/api/workshop/backup');data.device={workshopDrafts:drafts.value,characterDraft:JSON.parse(localStorage.getItem(`codex:character-builder:v1:${auth.user?.id??'local'}`)??'null'),appearance:JSON.parse(localStorage.getItem('codex:builder-appearance:v1')??'null')};download('codex-of-heroes-backup.json',JSON.stringify(data,null,2),'application/json');exportNote.value='Complete backup downloaded: saved packs, custom content, characters, drafts, and appearance settings.'}catch(e){exportError.value=(e as Error).message}finally{exportBusy.value=false}}
</script>

<template><div class="hw-page">
  <header class="hw-page-header"><div><p class="hw-eyebrow">YOUR RULES. YOUR WORLD.</p><h1>Homebrew Workshop <span class="hw-pill">Classes, subclasses, races & items</span></h1><p class="hw-hint">Create rules and items, with their effects visible as you work.</p></div><div v-show="workshopArea==='rules'" class="hw-actions"><template v-if="draft"><button class="hw-button" @click="back">← Library</button><button class="hw-button" @click="persist(true)">Save draft</button><button class="hw-button hw-button-primary" @click="step='review';publishOpen=true">Save to pack</button></template><template v-else><button class="hw-button" :disabled="exportBusy" @click="backup">Download site backup</button><button class="hw-button" @click="open(newWorkshopDraft('race'))">+ New race</button><button class="hw-button" @click="open(newWorkshopDraft('subclass'))">+ New subclass</button><button class="hw-button hw-button-primary" @click="open(newWorkshopDraft())">+ New class</button></template></div></header>
  <nav class="hw-actions" aria-label="Workshop content sections" style="margin-bottom:20px"><button class="hw-button" :class="{'hw-button-primary':workshopArea==='rules'}" @click="workshopArea='rules'">Classes, subclasses &amp; races</button><button class="hw-button" :class="{'hw-button-primary':workshopArea==='items'}" @click="persist();workshopArea='items'">Normal &amp; magic items</button></nav><ItemWorkshop v-if="workshopArea==='items'" /><template v-else><p v-if="storageError" class="hw-alert" role="alert">{{storageError}}</p><p v-if="saveStatus" class="hw-save-status" role="status">{{saveStatus}}</p><p v-if="loadError" class="hw-alert" role="status">{{loadError}}</p>
  <p v-if="exportError" class="hw-alert" role="alert">{{exportError}}</p><p v-if="exportNote" class="hw-callout" role="status">{{exportNote}}</p><div v-if="draft" class="hw-export-actions"><button class="hw-text-button" :disabled="exportBusy" @click="exportDraft">{{exportBusy?'Preparing download…':'Export this definition as Orcbrew ↓'}}</button><button class="hw-text-button" :disabled="exportBusy" @click="backup">Download complete site backup ↓</button><span v-if="draft.published" class="hw-pill">Saved revision {{draft.published.revision}}</span></div>
  <div v-if="draft" class="hw-workspace"><nav class="hw-step-nav" aria-label="Workshop sections"><div class="hw-draft-title"><span class="hw-eyebrow">{{draft.kind}} DRAFT</span><strong>{{draft.name||'Untitled creation'}}</strong></div><button v-for="(section,index) in WORKSHOP_STEPS" :key="section.key" type="button" :class="{active:step===section.key}" :aria-current="step===section.key?'step':undefined" @click="step=section.key"><span class="hw-step-number">{{index+1}}</span><span><strong>{{draft.kind==='race'?({foundation:'Body & training',progression:'Trait progression',magic:'Innate spells',features:'Traits & choices'} as Record<string,string>)[section.key]??section.name:section.name}}</strong><small>{{draft.kind==='race'?(section.key==='foundation'?'Speed, size, bonuses & training':section.key==='magic'?'Racial spell grants & casting rules':section.key==='identity'?'Name, source & lore':'Rules by character level'):section.hint}}</small></span></button><p class="hw-nav-note">Drafts save on this device when you leave the editor. Save to a pack when you’re ready to apply these rules.</p></nav><WorkshopEditor :draft="draft" :step="step" :classes="classes" :spells="spells" @step="step=$event" @save="persist(true)" @publish="publishOpen=true"/><WorkshopPreview :draft="draft" :step="step" :level="level" :scores="scores" @level="level=$event" @score="(key,value)=>scores[key]=value"/></div>
  <div v-else class="hw-library"><section class="hw-library-intro hw-panel"><div><p class="hw-eyebrow">CREATE A CLASS, SUBCLASS, OR RACE</p><h2>A workbench for your next hero.</h2><p>Shape your rules, map their progression, and preview traits, spellcasting, and resource pools at any level.</p><p class="hw-hint">Draft privately on this device, then save to an imported, different, or new pack. Linked characters receive saved rule changes automatically, with play state preserved and conflicts flagged.</p></div><div class="hw-intro-facts"><span><b>01—20</b>Level preview</span><span><b>7</b>Guided sections</span><span><b>Live</b>Rule calculations</span></div></section>
  <div class="hw-library-toolbar"><label>Find content<input v-model="query" type="search" placeholder="Search by name or source…"/></label><div class="hw-actions" aria-label="Content type"><button class="hw-button" :class="{'hw-button-primary':kind==='class'}" :aria-pressed="kind==='class'" @click="kind='class'">Classes</button><button class="hw-button" :class="{'hw-button-primary':kind==='subclass'}" :aria-pressed="kind==='subclass'" @click="kind='subclass'">Subclasses</button><button class="hw-button" :class="{'hw-button-primary':kind==='race'}" :aria-pressed="kind==='race'" @click="kind='race'">Races</button></div></div>
  <section v-if="libraryInfo.packs.length" class="hw-panel hw-pack-list"><div class="hw-between"><h2>Your packs</h2><button class="hw-text-button" :disabled="loading" @click="loadLibrary">Reload library</button></div><div v-for="pack in libraryInfo.packs" :key="pack.id" class="hw-between"><span>{{pack.filename}}</span><a class="hw-text-button" :href="`/api/content/orcbrew-packs/${pack.id}/export`" download>Export Orcbrew ↓</a></div></section><section v-if="draftMatches.length" class="hw-library-section"><div class="hw-between"><h2>Your drafts</h2><span class="hw-hint">Saved on this device</span></div><div class="hw-library-grid"><button v-for="item in draftMatches" :key="item.localId??item.id" class="hw-content-card" @click="open(item)"><span class="hw-eyebrow">{{item.kind}} · DRAFT</span><strong>{{item.name||'Untitled creation'}}</strong><small>{{item.source}}</small><span class="hw-content-footer">{{item.features.length}} features · {{item.resources.length}} trackers <b>Continue →</b></span></button></div></section>
  <section class="hw-library-section"><div class="hw-between"><h2>In your packs <span class="hw-pill">{{matches.length}}</span></h2><span class="hw-hint">Open a definition to edit its rules</span></div><p v-if="loading" role="status" class="hw-empty-inline">Loading your content library…</p><p v-else-if="!matches.length" class="hw-empty-inline">No {{kind==='race'?'races':kind==='class'?'classes':'subclasses'}} match. Create something new, or import an Orcbrew pack in the Compendium.</p><div v-else class="hw-library-grid"><button v-for="entry in matches" :key="entry.index" class="hw-content-card" @click="openImported(entry)"><span class="hw-eyebrow">{{entry.kind}} · {{entry.workshop?`SAVED · REVISION ${entry.workshopRevision??1}`:'IMPORTED'}}</span><strong>{{contentLabel(entry)}}</strong><small>{{entry.sourcePack||'Imported collection'}}</small><span class="hw-content-footer">{{entry.workshop?'Linked character rules':'Preserved original rules'}} <b>Open draft →</b></span></button></div></section></div>
<WorkshopPublish v-if="publishOpen&&draft" :draft="draft" @close="publishOpen=false" @saved="published"/></template></div></template>
