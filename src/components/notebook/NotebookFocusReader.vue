<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import type {NotebookEntry,NotebookSummary} from '../../../shared/notebook'
import {notebookReading} from '../../../shared/notebook-codex'
import NotebookText from './NotebookText.vue'
import NotebookConnections from './NotebookConnections.vue'
import NotebookGallery from './NotebookGallery.vue'
import './notebook-focus.css'

type Section='description'|'clues'|'encounters'|'connections'|'gallery'
const props=defineProps<{entry:NotebookEntry;initialSection:Section;clueId?:string;links:{id:string;title:string}[];sessions:NotebookSummary[];dm:boolean;loading:boolean;error:string;canGoBack:boolean}>()
const emit=defineEmits<{close:[];open:[id:string];back:[]}>()
const dialog=ref<HTMLDialogElement|null>(null),scroller=ref<HTMLElement|null>(null),title=ref<HTMLElement|null>(null)
const section=ref<Section>(props.clueId?'clues':props.initialSection),clueId=ref(props.clueId??'')
const sections=computed<Section[]>(()=>props.entry.codexType==='quests'?['description','clues','encounters','connections']:props.entry.codexType==='places'?['description','gallery','encounters','connections']:['description','encounters','connections'])
const clues=computed(()=>props.entry.questClues??[])
const clueIndex=computed(()=>Math.max(0,clues.value.findIndex(clue=>clue.id===clueId.value)))
const clue=computed(()=>clues.value[clueIndex.value])
const encounters=computed(()=>notebookReading(props.entry.body,props.sessions).encounters)
const label=(tab:Section)=>tab==='description'?(props.entry.codexType==='places'?'Overview':'Description'):tab==='clues'?'Clues':tab==='encounters'?'Encounters':tab==='gallery'?'Gallery':'Connections'
const audience=computed(()=>props.entry.audience==='dm'?'DM only':props.entry.audience==='characters'?'Selected characters':'Whole room')
let previousOverflow=''
let previousRootOverflow='',previousRootGutter='',pageScroll={left:0,top:0}
function close(){dialog.value?.close()}
function keepFocus(event:KeyboardEvent){
  if(event.key!=='Tab'||[...document.querySelectorAll(':modal')].at(-1)!==dialog.value)return
  const controls=[...dialog.value.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')].filter(element=>element.tabIndex>=0&&!element.matches(':disabled')&&element.getClientRects().length>0)
  const first=controls[0],last=controls.at(-1)
  if(!first||!last)return
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
async function resetScroll(focus=false){await nextTick();scroller.value?.scrollTo({top:0,behavior:'instant'});if(focus)title.value?.focus({preventScroll:true})}
function chooseClue(id:string,focus=false){clueId.value=id;void resetScroll(focus)}
function move(delta:number){const next=clues.value[clueIndex.value+delta];if(next)chooseClue(next.id,true)}
watch(section,()=>{void resetScroll()})
watch(()=>props.entry.id,()=>{section.value='description';clueId.value='';void resetScroll(true)})
watch(sections,values=>{if(!values.includes(section.value))section.value='description'})
onMounted(()=>{
  pageScroll={left:window.scrollX,top:window.scrollY}
  previousOverflow=document.body.style.overflow
  previousRootOverflow=document.documentElement.style.overflow
  previousRootGutter=document.documentElement.style.scrollbarGutter
  document.documentElement.style.overflow='hidden'
  document.documentElement.style.scrollbarGutter='auto'
  document.body.style.overflow='hidden'
  dialog.value?.showModal()
})
onBeforeUnmount(()=>{
  dialog.value?.close()
  document.body.style.overflow=previousOverflow
  document.documentElement.style.overflow=previousRootOverflow
  document.documentElement.style.scrollbarGutter=previousRootGutter
  window.scrollTo({...pageScroll,behavior:'instant'})
})
</script>

<template>
  <dialog ref="dialog" class="notebook-focus" aria-label="Focused notebook reader" @keydown="keepFocus" @cancel.prevent="close" @close="emit('close')" @click="$event.target===$event.currentTarget&&close()">
    <div class="notebook-focus-frame">
      <header class="notebook-focus-top">
        <div class="notebook-focus-identity"><p>{{audience}}<span v-if="entry.codexType==='quests'"> · {{entry.questStatus==='finished'?'Finished quest':'Active quest'}}</span></p><h2>{{entry.title}}</h2></div>
        <button type="button" autofocus class="sheet-button notebook-focus-close" aria-label="Close focus view" @click="close">Close <span aria-hidden="true">×</span></button>
      </header>
      <div class="notebook-focus-navigation">
        <button v-if="canGoBack" type="button" class="sheet-button sheet-small-button" :disabled="loading" @click="emit('back')">Back to previous entry</button>
        <nav aria-label="Focused entry sections"><button v-for="tab in sections" :key="tab" type="button" class="sheet-button" :aria-pressed="section===tab" @click="section=tab">{{label(tab)}}<span v-if="tab==='clues'">{{clues.length}}</span></button></nav>
      </div>
      <p v-if="loading" class="notebook-focus-notice" role="status">Opening entry…</p>
      <p v-if="error" class="notebook-focus-notice sheet-alert" role="alert">{{error}}</p>
      <div class="notebook-focus-body" :class="{'has-clues':section==='clues'&&clues.length>0}" :aria-busy="loading">
        <nav v-if="section==='clues'&&clues.length" class="notebook-focus-clue-list" aria-label="Clues in this quest">
          <p>Gathered clues <span>{{clues.length}}</span></p>
          <button v-for="(item,index) in clues" :key="item.id" type="button" class="sheet-button" :aria-current="clue?.id===item.id?'true':undefined" @click="chooseClue(item.id)"><span>{{item.title}}</span><small>{{item.sessions.length?item.sessions.map(n=>n+'. session').join(', '):'Session unconfirmed'}}</small><small v-if="dm&&item.audience==='dm'">DM only</small><span class="notebook-focus-clue-number" aria-hidden="true">{{index+1}}</span></button>
        </nav>
        <main ref="scroller" class="notebook-focus-scroll" tabindex="0" aria-label="Focused entry content">
          <label v-if="section==='clues'&&clues.length" class="notebook-focus-clue-select">Choose a clue<select :value="clue?.id" @change="chooseClue(($event.target as HTMLSelectElement).value)"><option v-for="(item,index) in clues" :key="item.id" :value="item.id">{{index+1}}. {{item.title}}</option></select></label>
          <div class="notebook-focus-page">
            <template v-if="section==='clues'&&clue">
              <div class="notebook-focus-clue-meta"><span>Clue {{clueIndex+1}} of {{clues.length}}</span><span v-if="dm">{{entry.audience==='dm'?'Quest hidden from players':clue.audience==='dm'?'DM only':'Whole room'}}</span></div>
              <h3 ref="title" class="notebook-focus-heading" tabindex="-1">{{clue.title}}</h3>
              <p class="notebook-focus-sources">{{clue.sessions.length?'Sources: '+clue.sessions.map(n=>n+'. session').join(', '):'Session unconfirmed'}}</p>
              <NotebookText :body="clue.body||'No description recorded for this clue.'" :links="links" :sessions="sessions" @open="emit('open',$event)" />
            </template>
            <template v-else-if="section==='clues'"><h3 class="notebook-focus-heading">Gathered clues</h3><p class="sheet-small">{{dm?'No clues recorded yet.':'No clues shared yet.'}}</p></template>
            <template v-else-if="section==='description'">
              <img v-if="entry.codexType==='places'&&entry.coverImage" class="notebook-focus-cover" :src="entry.coverImage" alt="" />
              <h3 ref="title" class="notebook-focus-heading" tabindex="-1">{{label(section)}}</h3>
              <NotebookText :body="entry.reading.description||'No description recorded.'" :links="links" :sessions="sessions" @open="emit('open',$event)" />
            </template>
            <template v-else-if="section==='encounters'"><h3 ref="title" class="notebook-focus-heading" tabindex="-1">Encounters</h3><NotebookText :body="encounters||'No session encounter recorded yet.'" :links="links" :sessions="sessions" @open="emit('open',$event)" /></template>
            <NotebookGallery v-else-if="section==='gallery'" :images="entry.gallery??[]" :cover="entry.coverImage" :place="entry.title" :entry-id="entry.id" />
            <template v-else><h3 ref="title" class="notebook-focus-heading" tabindex="-1">Connections</h3><NotebookText v-if="entry.reading.relations" :body="entry.reading.relations" :links="links" @open="emit('open',$event)" /><NotebookConnections :connections="entry.connections" empty-text="No connected entries available." @open="emit('open',$event)" /></template>
          </div>
        </main>
      </div>
      <footer class="notebook-focus-foot"><span class="sheet-small">{{section==='clues'&&clue?'Clue '+(clueIndex+1)+' of '+clues.length:'Focus view'}}<span class="notebook-focus-escape"> · Esc to close</span></span><div v-if="section==='clues'&&clue" class="notebook-actions"><button type="button" class="sheet-button" :disabled="clueIndex===0" aria-label="Previous clue" @click="move(-1)">Previous</button><button type="button" class="sheet-button" :disabled="clueIndex===clues.length-1" aria-label="Next clue" @click="move(1)">Next</button></div></footer>
    </div>
  </dialog>
</template>
