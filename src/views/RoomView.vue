<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { api, ApiError } from '../lib/api'
import type { RoomDetail } from '../../shared/rooms'
import { useCharactersStore } from '../stores/characters'
import { useAuthStore } from '../stores/auth'
import CharacterRoster from '../components/characters/CharacterRoster.vue'
import PartyDashboard from '../components/party/PartyDashboard.vue'
import { cancelMotionWithin, vMotionCharacter, vMotionPanel } from '../directives/siteMotion'
import { useCharacterSwitchScroll } from '../composables/useCharacterSwitchScroll'
import { useVisiblePolling } from '../composables/useVisiblePolling'
import { revealNavigationTarget } from '../lib/navigation-scroll'
import CharacterSheetView from './CharacterSheetView.vue'
import ItemComposer from '../components/items/ItemComposer.vue'
import WorkshopRuleReview from '../components/workshop/WorkshopRuleReview.vue'
import '../rooms.css'

const route = useRoute(), store = useCharactersStore()
const roomId = computed(() => String(route.params.roomId)), room = ref<RoomDetail | null>(null), selected = ref(''), error = ref(''), notice = ref(''), busy = ref(false)
const sheet = ref<InstanceType<typeof CharacterSheetView> | null>(null), refreshing = ref(false), paused = ref(false)
const CampaignNotebook=defineAsyncComponent(()=>import('../components/notebook/CampaignNotebook.vue'))
const notebook=ref<InstanceType<typeof import('../components/notebook/CampaignNotebook.vue')['default']>|null>(null)
const RoomMaps=defineAsyncComponent(()=>import('../components/maps/RoomMaps.vue'))
const maps=ref<InstanceType<typeof import('../components/maps/RoomMaps.vue')['default']>|null>(null)
type RoomSection='party'|'characters'|'notebook'|'maps'
const querySection=():RoomSection=>route.query.section==='maps'?'maps':route.query.section==='notebook'?'notebook':route.query.section==='characters'||route.query.character?'characters':'party'
const roomSection=ref<RoomSection>(querySection())
const mapsVisited=ref(roomSection.value==='maps'),notebookEntry=ref('')
const partyDashboard=ref<InstanceType<typeof PartyDashboard>|null>(null),partySaving=ref(false),sheetOpened=ref(false)
const returnToParty=ref<HTMLButtonElement|null>(null)
const notebookCharacter=ref(typeof route.query.character==='string'?route.query.character:'')
function leaveNotebook(){if(notebook.value?.busy)return false;if(notebook.value?.dirty&&!window.confirm('Discard your unsaved notebook changes?'))return false;notebook.value?.discardDraft();return true}
function leaveMaps(){if(maps.value?.busy)return false;if(maps.value?.dirty&&!window.confirm('Discard your unsaved map changes?'))return false;maps.value?.discardDraft();return true}
function changeRoomSection(value:RoomSection,character='',entry=''){if(value===roomSection.value)return true;if(store.saving||partySaving.value||busy.value||!leaveNotebook()||!leaveMaps())return false;if(sheet.value?.editDirty){if(!window.confirm('Discard your unsaved character edits and change room sections?'))return false;sheet.value?.discardEdits()}notebookCharacter.value=character;notebookEntry.value=entry;if(value==='maps')mapsVisited.value=true;roomSection.value=value;if(value==='characters'){sheetOpened.value=true;void nextTick(()=>{if(roomSection.value==='characters'&&!playerPreview.value)void sheet.value?.retryOpen()})}if(value==='party')void partyDashboard.value?.restore();return true}
function openMappedNote(entry:string){changeRoomSection('notebook','',entry)}
async function openPartySheet(id:string,section:string){if(!changeRoomSection('characters'))return;sections.set(`${roomId.value}:${id}`,section);if(selected.value===id)sheet.value?.openSection(section);else select(id);await nextTick();returnToParty.value?.focus({preventScroll:true});revealNavigationTarget(returnToParty.value)}
async function refreshWorkspace(){await load(true);if(roomSection.value==='party')await partyDashboard.value?.refresh()}
function openNotebook(character:string){changeRoomSection('notebook',character)}
const playerPreview=ref(false)
const giveOpen=ref(false)
const rosterCollapsed=ref(false),rosterQuery=ref(''),motionSequence=ref(0),animateWhenReady=ref('')
const motionHost=ref<HTMLElement|null>(null),sections=new Map<string,string>()
const switchScroll=useCharacterSwitchScroll(motionHost)
const auth=useAuthStore()
const preferenceKey=computed(()=>`codex:room-workspace:v1:${auth.user?.id??'anonymous'}:${roomId.value}`)
let preferredCharacter=''
const initialSection=computed(()=>sections.get(`${roomId.value}:${selected.value}`)??'summary')
const viewRole=computed(()=>playerPreview.value?'player':room.value?.role??'player')
const previewMember=computed(()=>room.value?.characters.find(c=>c._id===selected.value)?.assignedTo)
const playerCharacters=computed(()=>!playerPreview.value?room.value?.characters??[]:room.value?.characters.filter(c=>previewMember.value?c.assignedTo===previewMember.value:c._id===selected.value)??[])
const previewName=computed(()=>room.value?.members.find(member=>member.id===previewMember.value)?.displayName)
function togglePlayerPreview(){if(store.saving||partySaving.value||busy.value||giveOpen.value||!leaveNotebook()||!leaveMaps())return;if(sheet.value?.editDirty&&!window.confirm('Discard your unsaved edits and switch views?'))return;cancelMotionWithin(motionHost.value);animateWhenReady.value='';playerPreview.value=!playerPreview.value;if(playerPreview.value){roomSection.value='characters';sheetOpened.value=true}else roomSection.value='party'}
const dmCharacters=computed(()=>(room.value?.characters??[]).map(character=>({
  ...character,
  meta:store.current?._id===character._id&&store.roomContext?.roomId===roomId.value?store.current.meta:character.meta,
  assignmentLabel:character.assignedTo?`Assigned to ${room.value?.members.find(m=>m.id===character.assignedTo)?.displayName??'player'}`:'Unassigned',
})))
function rememberSection(value:string){if(viewRole.value==='dm')sections.set(`${roomId.value}:${selected.value}`,value==='edit'?'summary':value)}
async function sheetReady(id:string){if(viewRole.value!=='dm'||selected.value!==id||animateWhenReady.value!==id)return;animateWhenReady.value='';await nextTick();if(selected.value===id)motionSequence.value++}
function sheetSettled(id:string){if(selected.value===id)void switchScroll.finish()}
watch([selected,rosterCollapsed],()=>{if(!room.value||room.value.role!=='dm')return;try{localStorage.setItem(preferenceKey.value,JSON.stringify({selected:selected.value,collapsed:rosterCollapsed.value}))}catch{/* Room preferences are optional. */}})
const selectedAssignment=computed(()=>{const character=room.value?.characters.find(c=>c._id===selected.value);return character?.assignedTo?'Assigned to '+(room.value?.members.find(m=>m.id===character.assignedTo)?.displayName??'player'):'Unassigned'})
function selectFromMenu(event:Event){const target=event.target as HTMLSelectElement;select(target.value);target.value=selected.value}
const joinLink = computed(() => room.value?.joinToken ? `${window.location.origin}/join#${room.value.joinToken}` : '')
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
    if(result.role==='player'&&roomSection.value==='party')roomSection.value='characters'
    if (!result.characters.some(c => c._id === selected.value)) { cancelMotionWithin(motionHost.value);selected.value = result.characters.find(c=>c._id===preferredCharacter)?._id??result.characters[0]?._id??'' }
    if (refresh && roomSection.value==='characters' && selected.value && !playerPreview.value && !sheet.value?.editDirty && !store.saving && store.current?._id === selected.value) await store.fetchOne(selected.value,{quick:true})
    else if(refresh&&roomSection.value==='characters'&&selected.value&&!store.current&&!playerPreview.value)await sheet.value?.retryOpen()
  } catch (e) {
    if (run !== generation) return
    if (e instanceof ApiError && [401,403,404].includes(e.status)) { room.value = null; selected.value = ''; store.current = null }
    error.value = e instanceof Error ? e.message : 'The room could not be refreshed.'
    paused.value = true
  } finally { refreshing.value = false; if (run !== generation) void load() }
}
function select(id: string) { if (selected.value === id||store.saving||busy.value||giveOpen.value||!leaveNotebook()||!leaveMaps()) return; if (sheet.value?.editDirty && !window.confirm('Discard your unsaved character edits and open another sheet?')) return;switchScroll.begin();cancelMotionWithin(motionHost.value);animateWhenReady.value=viewRole.value==='dm'?id:'';selected.value = id; notice.value = '' }
async function assign(characterId: string, event: Event) {
  const select = event.target as HTMLSelectElement, value = select.value
  busy.value = true; error.value = ''
  try { await api.post(`/api/rooms/${roomId.value}/assignments`, {characterId,userId:value||null}); notice.value = value ? 'Character assigned. The player can now open the sheet.' : 'Assignment removed.' } catch (e) { error.value = e instanceof Error ? e.message : 'Could not update the assignment.' } finally { busy.value = false; await load() }
}
async function copyLink() { try { await navigator.clipboard.writeText(joinLink.value); notice.value = 'Joining link copied.' } catch { notice.value = 'Select and copy the joining link below.' } }
async function replaceLink() { if (!window.confirm('Replace the joining link? The old link will stop working. Existing members keep their access.')) return; busy.value = true; try { await api.post(`/api/rooms/${roomId.value}/join-link`); notice.value = 'Joining link replaced.' } catch (e) { error.value = e instanceof Error ? e.message : 'Could not replace the link.' } finally { busy.value = false; await load() } }
async function removeMember(id: string) { if (!window.confirm('Remove this player and their character assignments? They can rejoin through the current joining link.')) return; busy.value = true; try { await api.delete(`/api/rooms/${roomId.value}/members/${id}`); notice.value = 'Player access removed.' } catch (e) { error.value = e instanceof Error ? e.message : 'Could not remove the player.' } finally { busy.value = false; await load() } }
const refresh = () => { if (document.visibilityState === 'visible') void load(true) }
watch(roomId, () => { generation++; playerPreview.value=false;room.value = null; selected.value = '';sheetOpened.value=false;partySaving.value=false;rosterQuery.value='';animateWhenReady.value='';preferredCharacter='';rosterCollapsed.value=false;try{const saved=JSON.parse(localStorage.getItem(preferenceKey.value)??'{}');if(typeof saved.selected==='string')preferredCharacter=saved.selected;rosterCollapsed.value=saved.collapsed===true}catch{/* Opening the room does not require storage. */}if(typeof route.query.character==='string')preferredCharacter=route.query.character;roomSection.value=querySection();mapsVisited.value=roomSection.value==='maps';notebookEntry.value='';if(roomSection.value==='characters')sheetOpened.value=true;notebookCharacter.value=typeof route.query.character==='string'?route.query.character:'';void load() }, {immediate:true})
useVisiblePolling(refresh, 15000)
useVisiblePolling(()=>{if(roomSection.value==='characters'&&document.visibilityState==='visible'&&selected.value&&!playerPreview.value&&!sheet.value?.editDirty&&!store.saving&&store.current?._id===selected.value)void store.fetchOne(selected.value,{quick:true}).catch(()=>{})},3000,{focus:false,visibility:false})
onUnmounted(() => { disposed=true; generation++; store.roomContext=null; store.current=null })
onBeforeRouteLeave(() => {if(!store.saving&&!partySaving.value&&!busy.value)return leaveNotebook()&&leaveMaps();notice.value='Please wait for the current save before leaving the room.';return false})
onBeforeRouteUpdate((to,from)=>{if(to.params.roomId===from.params.roomId)return true;if(store.saving||partySaving.value||busy.value||!leaveNotebook()||!leaveMaps())return false;return !sheet.value?.editDirty||window.confirm('Discard your unsaved character edits and open another room?')})
</script>
<template>
  <div class="game-room hero-sheet" :class="{'room-dm-library':viewRole==='dm'}"><RouterLink to="/rooms" class="sheet-small">← Game rooms</RouterLink>
    <header class="room-page-heading"><div><p class="sheet-eyebrow">PRIVATE GAME ROOM</p><h1>{{room?.name ?? 'Opening your table…'}}</h1><p class="sheet-small">{{playerPreview?'Player preview':room?.role==='dm'?'Dungeon Master':'Player · your assigned characters'}}</p></div><div v-if="room" class="room-view-actions"><button v-if="room.role==='dm'" type="button" role="switch" :aria-checked="playerPreview" class="sheet-button" :class="{active:playerPreview}" :disabled="store.saving||partySaving" @click="togglePlayerPreview">Player view</button><button v-if="room.role==='dm'&&!playerPreview&&roomSection==='characters'" type="button" class="sheet-button sheet-button-primary" :disabled="!selected||store.saving||sheet?.editDirty" @click="giveOpen=true">Give item</button><button class="sheet-button" :disabled="refreshing||busy||partySaving" @click="refreshWorkspace">Refresh</button></div></header>
    <p v-if="error" class="sheet-alert" role="alert">{{error}}</p><p v-if="notice" class="room-notice" role="status">{{notice}}</p><p v-if="paused" class="sheet-notice">Room updates are paused. Refresh before continuing.</p>
    <nav v-if="room" class="room-section-nav" aria-label="Game room sections"><button v-if="room.role==='dm'&&!playerPreview" type="button" class="sheet-button" :aria-current="roomSection==='party'?'page':undefined" @click="changeRoomSection('party')">Party dashboard</button><button type="button" class="sheet-button" :aria-current="roomSection==='characters'?'page':undefined" @click="changeRoomSection('characters')">Characters</button><button type="button" class="sheet-button" :aria-current="roomSection==='notebook'?'page':undefined" @click="changeRoomSection('notebook')">Campaign notebook</button><button type="button" class="sheet-button" :aria-current="roomSection==='maps'?'page':undefined" @click="changeRoomSection('maps')">Maps</button></nav>
    <WorkshopRuleReview v-if="room?.role==='dm'&&!playerPreview&&roomSection==='characters'&&store.current?._id===selected&&store.canEditPermanent" :character-name="store.current.meta.name" @edit="sheet?.reviewRules()" />
    <details v-if="room?.role==='dm'&&!playerPreview" class="sheet-panel room-management"><summary>Players & assignments <span class="sheet-small">{{room.members.length}} players · {{room.characters.filter(c=>c.assignedTo).length}} assigned characters</span></summary>
      <details class="room-invite-details"><summary>Invite players</summary><p class="sheet-small">This link stays available until replaced. Players sign in, join, then receive a character assignment.</p><label>Joining link<input :value="joinLink" readonly @focus="($event.target as HTMLInputElement).select()" /></label><div class="sheet-filter-buttons"><button class="sheet-button" @click="copyLink">Copy link</button><button class="sheet-button" :disabled="busy" @click="replaceLink">Replace joining link</button></div></details>
      <div class="room-assignment-grid"><label v-for="character in room.characters" :key="character._id">{{character.meta.name}}<select :value="character.assignedTo??''" :disabled="busy" @change="assign(character._id,$event)"><option value="">Unassigned</option><option v-for="member in room.members" :key="member.id" :value="member.id">{{member.displayName}}{{member.email?` · ${member.email}`:''}}</option></select></label></div>
      <details class="room-members"><summary>Manage players · {{room.members.length}}</summary><p v-if="!room.members.length" class="sheet-small">Players appear here after joining.</p><div v-for="member in room.members" :key="member.id" class="sheet-between"><span>{{member.displayName}}<small v-if="member.email" class="sheet-small" style="display:block">{{member.email}}</small></span><button class="sheet-button sheet-small-button" :disabled="busy" @click="removeMember(member.id)">Remove player</button></div></details>
    </details>
    <div v-if="room?.role==='dm'&&playerPreview" class="room-character-toolbar"><label>Preview character<select :value="selected" @change="selectFromMenu"><option v-if="!room.characters.length" value="">No characters available</option><option v-for="character in room.characters" :key="character._id" :value="character._id">{{character.meta.name}} · Level {{character.meta.level}} {{character.meta.klass}}</option></select></label><p v-if="selected" class="sheet-small">{{selectedAssignment}}</p></div>
    <p v-if="playerPreview" class="room-preview-banner" role="status"><strong>{{previewName?`${previewName}’s player view`:'Player view · character preview'}}</strong><span>Try HP, slots, points, and equipment here. Preview changes are temporary and are not saved. Switch Player view off to return to your live DM sheet.</span></p>
    <div v-motion-panel="roomSection" class="room-section-content">
    <PartyDashboard v-if="room?.role==='dm'&&!playerPreview" v-show="roomSection==='party'" :key="room.id" ref="partyDashboard" :room="room" :preference-key="`${preferenceKey}:party`" :active="roomSection==='party'" :disabled="busy||store.saving" @open="openPartySheet" @busy="partySaving=$event" @access-lost="load()" />
    <section v-if="room&&roomSection==='notebook'" class="room-notebook-workspace"><CampaignNotebook v-if="!playerPreview||selected" ref="notebook" :key="`${room.id}:${playerPreview}:${playerPreview?selected:''}`" :room-id="room.id" :preview-character="playerPreview?selected:undefined" :initial-character="notebookCharacter" :initial-entry="notebookEntry" /><p v-else class="sheet-notice">Choose a character to preview the notebook as a player.</p></section>
    <section v-if="room&&mapsVisited" v-show="roomSection==='maps'" class="room-map-workspace"><RoomMaps v-if="!playerPreview||selected" ref="maps" :key="`${room.id}:${playerPreview}:${playerPreview?selected:''}`" :room-id="room.id" :active="roomSection==='maps'" :preview-character="playerPreview?selected:undefined" @open-notebook="openMappedNote" /><p v-else class="sheet-notice">Choose a character to preview shared maps.</p></section>
    <div v-if="room" v-show="roomSection==='characters'" :class="viewRole==='dm'?'character-workspace room-dm-workspace':{'room-workspace':true,'room-player-workspace':playerCharacters.length<=1}" :data-collapsed="rosterCollapsed">
      <div v-if="viewRole==='dm'" class="room-party-return"><button ref="returnToParty" type="button" class="sheet-button" :disabled="store.saving||busy" @click="changeRoomSection('party')">← Back to party dashboard</button><span class="sheet-small">{{room.characters.find(c=>c._id===selected)?.meta.name}}</span></div>
      <CharacterRoster v-if="viewRole==='dm'&&room.characters.length" v-model:query="rosterQuery" :characters="dmCharacters" :selected-id="selected" :collapsed="rosterCollapsed" :disabled="busy||store.saving||giveOpen" @toggle="rosterCollapsed=!rosterCollapsed" @select="select" />
      <aside v-if="viewRole==='player'&&playerCharacters.length>1" class="sheet-panel room-roster"><h2>Your characters</h2><article v-for="character in playerCharacters" :key="character._id" class="room-roster-entry"><button class="room-character-button" :aria-pressed="selected===character._id" @click="select(character._id)"><strong>{{character.meta.name}}</strong><small>Level {{character.meta.level}} · {{character.meta.klass}}</small></button></article></aside>
      <div class="room-selected-sheet">
        <div v-if="viewRole==='dm'&&selected" class="room-selected-tools"><span class="sheet-small">{{selectedAssignment}}</span><label class="room-selected-assignment">Assigned player<select :value="room.characters.find(c=>c._id===selected)?.assignedTo??''" :disabled="busy||store.saving" @change="assign(selected,$event)"><option value="">Unassigned</option><option v-for="member in room.members" :key="member.id" :value="member.id">{{member.displayName}}</option></select></label></div>
        <div ref="motionHost" v-motion-character="viewRole==='dm'?motionSequence:0" :class="{'character-sheet-container':viewRole==='dm','character-sheet-motion':viewRole==='dm'}"><CharacterSheetView v-if="selected&&(viewRole==='player'||sheetOpened||roomSection==='characters')" ref="sheet" :key="`${room.id}:${selected}:${playerPreview}`" :character-id="selected" :room-id="room.id" :role="viewRole" :compact-summary="viewRole==='dm'" :embedded="viewRole==='dm'" :initial-section="viewRole==='dm'?initialSection:undefined" :player-preview="playerPreview" @open-notebook="openNotebook" @ready="sheetReady" @settled="sheetSettled" @section-change="rememberSection" /><section v-else class="sheet-panel"><h2>{{room.role==='player'?'You’re at the table':'Choose a character'}}</h2><p class="sheet-prose">{{room.role==='player'?'Your DM has not assigned a character yet. This page updates while you wait.':'Import or create a character from your dashboard to use it here.'}}</p></section></div>
      </div>
    </div></div><ItemComposer v-if="giveOpen" mode="give" :character-id="selected" :character-name="room?.characters.find(c=>c._id===selected)?.meta.name" @close="giveOpen=false" @saved="notice=$event" />
  </div>
</template>
