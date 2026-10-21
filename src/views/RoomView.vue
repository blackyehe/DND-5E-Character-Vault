<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { api, ApiError } from '../lib/api'
import type { RoomDetail } from '../../shared/rooms'
import { useCharactersStore } from '../stores/characters'
import { useAuthStore } from '../stores/auth'
import CharacterRoster from '../components/characters/CharacterRoster.vue'
import { cancelMotionWithin, vMotionCharacter } from '../directives/siteMotion'
import CharacterSheetView from './CharacterSheetView.vue'
import ItemComposer from '../components/items/ItemComposer.vue'
import '../rooms.css'

const route = useRoute(), store = useCharactersStore()
const roomId = computed(() => String(route.params.roomId)), room = ref<RoomDetail | null>(null), selected = ref(''), error = ref(''), notice = ref(''), busy = ref(false)
const sheet = ref<InstanceType<typeof CharacterSheetView> | null>(null), refreshing = ref(false), paused = ref(false)
const playerPreview=ref(false)
const giveOpen=ref(false)
const rosterCollapsed=ref(false),rosterQuery=ref(''),motionSequence=ref(0),animateWhenReady=ref('')
const motionHost=ref<HTMLElement|null>(null),sections=new Map<string,string>()
const auth=useAuthStore()
const preferenceKey=computed(()=>`codex:room-workspace:v1:${auth.user?.id??'anonymous'}:${roomId.value}`)
let preferredCharacter=''
const initialSection=computed(()=>sections.get(`${roomId.value}:${selected.value}`)??'summary')
const viewRole=computed(()=>playerPreview.value?'player':room.value?.role??'player')
const previewMember=computed(()=>room.value?.characters.find(c=>c._id===selected.value)?.assignedTo)
const playerCharacters=computed(()=>!playerPreview.value?room.value?.characters??[]:room.value?.characters.filter(c=>previewMember.value?c.assignedTo===previewMember.value:c._id===selected.value)??[])
const previewName=computed(()=>room.value?.members.find(member=>member.id===previewMember.value)?.displayName)
function togglePlayerPreview(){if(store.saving||busy.value||giveOpen.value)return;if(sheet.value?.editDirty&&!window.confirm('Discard your unsaved edits and switch views?'))return;cancelMotionWithin(motionHost.value);animateWhenReady.value='';playerPreview.value=!playerPreview.value}
const dmCharacters=computed(()=>(room.value?.characters??[]).map(character=>({
  ...character,
  meta:store.current?._id===character._id&&store.roomContext?.roomId===roomId.value?store.current.meta:character.meta,
  assignmentLabel:character.assignedTo?`Assigned to ${room.value?.members.find(m=>m.id===character.assignedTo)?.displayName??'player'}`:'Unassigned',
})))
function rememberSection(value:string){if(viewRole.value==='dm')sections.set(`${roomId.value}:${selected.value}`,value==='edit'?'summary':value)}
async function sheetReady(id:string){if(viewRole.value!=='dm'||selected.value!==id||animateWhenReady.value!==id)return;animateWhenReady.value='';await nextTick();if(selected.value===id)motionSequence.value++}
watch([selected,rosterCollapsed],()=>{if(!room.value||room.value.role!=='dm')return;try{localStorage.setItem(preferenceKey.value,JSON.stringify({selected:selected.value,collapsed:rosterCollapsed.value}))}catch{/* Room preferences are optional. */}})
const selectedAssignment=computed(()=>{const character=room.value?.characters.find(c=>c._id===selected.value);return character?.assignedTo?'Assigned to '+(room.value?.members.find(m=>m.id===character.assignedTo)?.displayName??'player'):'Unassigned'})
function selectFromMenu(event:Event){const target=event.target as HTMLSelectElement;select(target.value);target.value=selected.value}
const joinLink = computed(() => room.value?.joinToken ? `${window.location.origin}/join#${room.value.joinToken}` : '')
let timer: ReturnType<typeof setInterval> | undefined
let sheetTimer:ReturnType<typeof setInterval>|undefined
let generation = 0
let disposed = false
async function load(refresh = false) {
  if (disposed || refreshing.value || busy.value) return
  const run = generation, id = roomId.value
  refreshing.value = true
  try {
    const result = await api.get<RoomDetail>(`/api/rooms/${id}`)
    if (run !== generation) return
    room.value = result; error.value = ''; paused.value = false
    if (!result.characters.some(c => c._id === selected.value)) { cancelMotionWithin(motionHost.value);selected.value = result.characters.find(c=>c._id===preferredCharacter)?._id??result.characters[0]?._id??'' }
    if (refresh && selected.value && !playerPreview.value && !sheet.value?.editDirty && !store.saving && store.current?._id === selected.value) await store.fetchOne(selected.value,{quick:true})
    else if(refresh&&selected.value&&!store.current&&!playerPreview.value)await sheet.value?.retryOpen()
  } catch (e) {
    if (run !== generation) return
    if (e instanceof ApiError && [401,403,404].includes(e.status)) { room.value = null; selected.value = ''; store.current = null }
    error.value = e instanceof Error ? e.message : 'The room could not be refreshed.'
    paused.value = true
  } finally { refreshing.value = false; if (run !== generation) void load() }
}
function select(id: string) { if (selected.value === id||store.saving||busy.value||giveOpen.value) return; if (sheet.value?.editDirty && !window.confirm('Discard your unsaved character edits and open another sheet?')) return;cancelMotionWithin(motionHost.value);animateWhenReady.value=viewRole.value==='dm'?id:'';selected.value = id; notice.value = '' }
async function assign(characterId: string, event: Event) {
  const select = event.target as HTMLSelectElement, value = select.value
  busy.value = true; error.value = ''
  try { await api.post(`/api/rooms/${roomId.value}/assignments`, {characterId,userId:value||null}); notice.value = value ? 'Character assigned. The player can now open the sheet.' : 'Assignment removed.' } catch (e) { error.value = e instanceof Error ? e.message : 'Could not update the assignment.' } finally { busy.value = false; await load() }
}
async function copyLink() { try { await navigator.clipboard.writeText(joinLink.value); notice.value = 'Joining link copied.' } catch { notice.value = 'Select and copy the joining link below.' } }
async function replaceLink() { if (!window.confirm('Replace the joining link? The old link will stop working. Existing members keep their access.')) return; busy.value = true; try { await api.post(`/api/rooms/${roomId.value}/join-link`); notice.value = 'Joining link replaced.' } catch (e) { error.value = e instanceof Error ? e.message : 'Could not replace the link.' } finally { busy.value = false; await load() } }
async function removeMember(id: string) { if (!window.confirm('Remove this player and their character assignments? They can rejoin through the current joining link.')) return; busy.value = true; try { await api.delete(`/api/rooms/${roomId.value}/members/${id}`); notice.value = 'Player access removed.' } catch (e) { error.value = e instanceof Error ? e.message : 'Could not remove the player.' } finally { busy.value = false; await load() } }
const refresh = () => { if (document.visibilityState === 'visible') void load(true) }
watch(roomId, () => { generation++; playerPreview.value=false;room.value = null; selected.value = '';rosterQuery.value='';animateWhenReady.value='';preferredCharacter='';rosterCollapsed.value=false;try{const saved=JSON.parse(localStorage.getItem(preferenceKey.value)??'{}');if(typeof saved.selected==='string')preferredCharacter=saved.selected;rosterCollapsed.value=saved.collapsed===true}catch{/* Opening the room does not require storage. */}void load() }, {immediate:true})
onMounted(() => { timer = setInterval(refresh, 15000);sheetTimer=setInterval(()=>{if(document.visibilityState==='visible'&&selected.value&&!playerPreview.value&&!sheet.value?.editDirty&&!store.saving&&store.current?._id===selected.value)void store.fetchOne(selected.value,{quick:true}).catch(()=>{})},3000); window.addEventListener('focus',refresh); document.addEventListener('visibilitychange',refresh) })
onUnmounted(() => { disposed=true; generation++; clearInterval(timer);clearInterval(sheetTimer); window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',refresh); store.roomContext=null; store.current=null })
onBeforeRouteLeave(() => {if(!store.saving&&!busy.value)return true;notice.value='Please wait for the current save before leaving the room.';return false})
</script>
<template>
  <div class="game-room hero-sheet" :class="{'room-dm-library':viewRole==='dm'}"><RouterLink to="/rooms" class="sheet-small">← Game rooms</RouterLink>
    <header class="room-page-heading"><div><p class="sheet-eyebrow">PRIVATE GAME ROOM</p><h1>{{room?.name ?? 'Opening your table…'}}</h1><p class="sheet-small">{{playerPreview?'Player preview':room?.role==='dm'?'Dungeon Master':'Player · your assigned characters'}}</p></div><div v-if="room" class="room-view-actions"><button v-if="room.role==='dm'" type="button" role="switch" :aria-checked="playerPreview" class="sheet-button" :class="{active:playerPreview}" :disabled="store.saving" @click="togglePlayerPreview">Player view</button><button v-if="room.role==='dm'&&!playerPreview" type="button" class="sheet-button sheet-button-primary" :disabled="!selected||store.saving||sheet?.editDirty" @click="giveOpen=true">Give item</button><button class="sheet-button" :disabled="refreshing||busy" @click="load(true)">Refresh</button></div></header>
    <p v-if="error" class="sheet-alert" role="alert">{{error}}</p><p v-if="notice" class="room-notice" role="status">{{notice}}</p><p v-if="paused" class="sheet-notice">Room updates are paused. Refresh before continuing.</p>
    <details v-if="room?.role==='dm'&&!playerPreview" class="sheet-panel room-management"><summary>Players & assignments <span class="sheet-small">{{room.members.length}} players · {{room.characters.filter(c=>c.assignedTo).length}} assigned characters</span></summary>
      <details class="room-invite-details"><summary>Invite players</summary><p class="sheet-small">This link stays available until replaced. Players sign in, join, then receive a character assignment.</p><label>Joining link<input :value="joinLink" readonly @focus="($event.target as HTMLInputElement).select()" /></label><div class="sheet-filter-buttons"><button class="sheet-button" @click="copyLink">Copy link</button><button class="sheet-button" :disabled="busy" @click="replaceLink">Replace joining link</button></div></details>
      <div class="room-assignment-grid"><label v-for="character in room.characters" :key="character._id">{{character.meta.name}}<select :value="character.assignedTo??''" :disabled="busy" @change="assign(character._id,$event)"><option value="">Unassigned</option><option v-for="member in room.members" :key="member.id" :value="member.id">{{member.displayName}}{{member.email?` · ${member.email}`:''}}</option></select></label></div>
      <details class="room-members"><summary>Manage players · {{room.members.length}}</summary><p v-if="!room.members.length" class="sheet-small">Players appear here after joining.</p><div v-for="member in room.members" :key="member.id" class="sheet-between"><span>{{member.displayName}}<small v-if="member.email" class="sheet-small" style="display:block">{{member.email}}</small></span><button class="sheet-button sheet-small-button" :disabled="busy" @click="removeMember(member.id)">Remove player</button></div></details>
    </details>
    <div v-if="room?.role==='dm'&&playerPreview" class="room-character-toolbar"><label>Preview character<select :value="selected" @change="selectFromMenu"><option v-if="!room.characters.length" value="">No characters available</option><option v-for="character in room.characters" :key="character._id" :value="character._id">{{character.meta.name}} · Level {{character.meta.level}} {{character.meta.klass}}</option></select></label><p v-if="selected" class="sheet-small">{{selectedAssignment}}</p></div>
    <p v-if="playerPreview" class="room-preview-banner" role="status"><strong>{{previewName?`${previewName}’s player view`:'Player view · character preview'}}</strong><span>Try HP, slots, points, and equipment here. Preview changes are temporary and are not saved. Switch Player view off to return to your live DM sheet.</span></p>
    <div v-if="room" :class="viewRole==='dm'?'character-workspace room-dm-workspace':{'room-workspace':true,'room-player-workspace':playerCharacters.length<=1}" :data-collapsed="rosterCollapsed">
      <CharacterRoster v-if="viewRole==='dm'&&room.characters.length" v-model:query="rosterQuery" :characters="dmCharacters" :selected-id="selected" :collapsed="rosterCollapsed" :disabled="busy||store.saving||giveOpen" @toggle="rosterCollapsed=!rosterCollapsed" @select="select" />
      <aside v-if="viewRole==='player'&&playerCharacters.length>1" class="sheet-panel room-roster"><h2>Your characters</h2><article v-for="character in playerCharacters" :key="character._id" class="room-roster-entry"><button class="room-character-button" :aria-pressed="selected===character._id" @click="select(character._id)"><strong>{{character.meta.name}}</strong><small>Level {{character.meta.level}} · {{character.meta.klass}}</small></button></article></aside>
      <div class="room-selected-sheet">
        <div v-if="viewRole==='dm'&&selected" class="room-selected-tools"><span class="sheet-small">{{selectedAssignment}}</span><label class="room-selected-assignment">Assigned player<select :value="room.characters.find(c=>c._id===selected)?.assignedTo??''" :disabled="busy||store.saving" @change="assign(selected,$event)"><option value="">Unassigned</option><option v-for="member in room.members" :key="member.id" :value="member.id">{{member.displayName}}</option></select></label></div>
        <div ref="motionHost" v-motion-character="viewRole==='dm'?motionSequence:0" :class="{'character-sheet-container':viewRole==='dm','character-sheet-motion':viewRole==='dm'}"><CharacterSheetView v-if="selected" ref="sheet" :key="`${room.id}:${selected}:${playerPreview}`" :character-id="selected" :room-id="room.id" :role="viewRole" :compact-summary="viewRole==='dm'" :embedded="viewRole==='dm'" :initial-section="viewRole==='dm'?initialSection:undefined" :player-preview="playerPreview" @ready="sheetReady" @section-change="rememberSection" /><section v-else class="sheet-panel"><h2>{{room.role==='player'?'You’re at the table':'Choose a character'}}</h2><p class="sheet-prose">{{room.role==='player'?'Your DM has not assigned a character yet. This page updates while you wait.':'Import or create a character from your dashboard to use it here.'}}</p></section></div>
      </div>
    </div><ItemComposer v-if="giveOpen" mode="give" :character-id="selected" :character-name="room?.characters.find(c=>c._id===selected)?.meta.name" @close="giveOpen=false" @saved="notice=$event" />
  </div>
</template>
