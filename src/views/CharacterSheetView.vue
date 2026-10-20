<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import WorkshopRuleReview from '../components/workshop/WorkshopRuleReview.vue'
import { useRoute, RouterLink, onBeforeRouteLeave } from 'vue-router'
import { useCharactersStore, type Character } from '../stores/characters'
import { provideSheetLibrary } from '../composables/useSheetLibrary'
import CharacterSummary from '../components/sheet/CharacterSummary.vue'
import CharacterSidebar from '../components/sheet/CharacterSidebar.vue'
import CharacterSheetFrame from '../components/sheet/CharacterSheetFrame.vue'
import { useBuilderAppearance } from '../composables/useBuilderAppearance'
import CombatTab from '../components/sheet/CombatTab.vue'
import EquipmentSpellsTab from '../components/sheet/EquipmentSpellsTab.vue'
import FeaturesTab from '../components/sheet/FeaturesTab.vue'
import CoreTab from '../components/sheet/CoreTab.vue'
import BioTab from '../components/sheet/BioTab.vue'
import CharacterEditTab from '../components/sheet/CharacterEditTab.vue'
import SpellbookPanel from '../components/sheet/SpellbookPanel.vue'
import '../components/sheet/sheet.css'
import '../components/sheet/sheet-details.css'
import ShadowChampions from '../components/ShadowChampions.vue'
import { progressionClasses } from '../../shared/character-progression'
import { isRevenantShadow } from '../../shared/class-rules'
const route = useRoute(), store = useCharactersStore()
const props = defineProps<{ characterId?: string; roomId?: string; role?: 'dm' | 'player'; compactSummary?:boolean; playerPreview?:boolean;championFor?:string }>()
const id = computed(() => props.characterId ?? String(route.params.id))
const c = computed(() => store.current as Character)
const championClass=computed(()=>c.value?progressionClasses(c.value).find(entry=>isRevenantShadow(entry.name)):undefined)
const library = provideSheetLibrary(c)
const {appearance}=useBuilderAppearance()
const active = ref('combat'), loadError = ref('')
watch(()=>appearance.sheetLayout,layout=>{if(layout==='classic'&&!props.compactSummary&&active.value==='summary')active.value='combat'})
const editSection=ref('identity'),repairSpell=ref(''),repairOpen=ref(false),sheetMain=ref<HTMLElement|null>(null)
const editDirty = ref(false), pendingTab = ref(''),pendingRules=ref(false)
watch(active,value=>{store.editing=value==='edit'},{immediate:true})
watch(()=>store.rulesPending,value=>{if(value)pendingRules.value=true})
let refreshingRules=false
async function refreshRules(){if(refreshingRules||store.roomContext?.preview||store.loading)return;if(editDirty.value){pendingRules.value=true;return}if(store.saving||!store.current)return;refreshingRules=true;try{await store.fetchOne(id.value,{quick:true});await library.reload();pendingRules.value=false}catch{/* Existing character stays usable. */}finally{refreshingRules=false}}
const storageRefresh=(event:StorageEvent)=>{if(event.key==='codex:workshop-revision')void refreshRules()}
const focusRefresh=()=>{if(!props.roomId&&document.visibilityState==='visible')void refreshRules()}
onMounted(()=>{window.addEventListener('codex:workshop-published',refreshRules);window.addEventListener('focus',focusRefresh);window.addEventListener('storage',storageRefresh);document.addEventListener('visibilitychange',focusRefresh)})
onUnmounted(()=>{store.editing=false;window.removeEventListener('codex:workshop-published',refreshRules);window.removeEventListener('focus',focusRefresh);window.removeEventListener('storage',storageRefresh);document.removeEventListener('visibilitychange',focusRefresh)})
function openSpellRepair(index=''){editSection.value='spells';repairSpell.value=index;repairOpen.value=true;switchTab('edit')}
function showTab(key:string){active.value=key;void nextTick(()=>sheetMain.value?.scrollIntoView({block:'start'}))}
function switchTab(key: string) { if (key === active.value) return; if (editDirty.value) pendingTab.value = key; else showTab(key) }
function discardAndSwitch() { editDirty.value = false; showTab(pendingTab.value); pendingTab.value = '' }
onBeforeRouteLeave(() => !editDirty.value || window.confirm('Discard your unsaved character edits and leave this page?'))
const tabs = computed(() => [...(props.compactSummary||appearance.sheetLayout==='folio'?[{key:'summary',label:'Summary'}]:[]),{ key: 'combat', label: 'Combat' }, { key: 'spells', label: 'Spells' }, { key: 'equipment', label: 'Equipment' }, { key: 'features', label: 'Features' }, { key: 'proficiencies', label: 'Proficiencies' }, { key: 'bio', label: 'Bio & notes' },...(championClass.value&&!props.championFor?[{key:'champions',label:'Shadow Champions'}]:[]), ...(store.canEditPermanent ? [{ key: 'edit', label: 'Edit character' }] : [])])
async function openCharacter(){loadError.value='';try{await store.fetchOne(id.value,{quick:true})}catch(error){loadError.value=error instanceof Error?error.message:'Could not open this character. Try again.'}}
watch(() => [id.value, props.roomId, props.role,props.playerPreview,props.championFor] as const, async () => {
  store.roomContext = props.roomId ? { roomId: props.roomId, role: props.role ?? 'player',preview:props.playerPreview,championFor:props.championFor } : null
  active.value = props.compactSummary?'summary':'combat'; loadError.value = ''; store.current = null
  await openCharacter()
}, { immediate: true })
defineExpose({ editDirty,retryOpen:openCharacter })
</script>
<template>
  <div class="hero-sheet">
    <div class="sheet-page-top"><RouterLink v-if="championFor" :to="`/rooms/${roomId}`">← Game room</RouterLink><RouterLink v-else-if="!roomId" to="/">← Your characters</RouterLink><span>{{ role === 'player' ? 'PLAYER SHEET · PERMANENT EDITING BY DM' : 'CHARACTER SHEET · 2014 RULES' }}</span><span role="status">{{ playerPreview ? 'Temporary preview · changes are not saved' : store.saving ? 'Saving…' : 'Changes save automatically during play' }}</span></div>
    <p v-if="championFor" class="sheet-notice">Shadow Champion reference sheet. You can inspect every tab and try resources here; changes in this preview are temporary.</p><p v-if="loadError" class="sheet-alert" role="alert">{{ loadError }} <button type="button" class="sheet-button sheet-small-button" :disabled="store.loading" @click="openCharacter">Try again</button></p>
    <div v-else-if="c" ref="sheetMain">
      <CharacterSheetFrame :active="active" :tabs="tabs" :compact-summary="compactSummary" @select="switchTab" @edit="switchTab('edit')">
        <template #status>
        <section v-if="pendingTab" class="sheet-panel" role="alertdialog" aria-label="Unsaved character edits" style="margin-bottom:20px"><h3>Keep your edits?</h3><p class="sheet-small">Your character has unsaved changes. Save them in Edit, or discard the draft to change tabs.</p><div class="sheet-filter-buttons" style="margin-top:14px"><button class="sheet-button" @click="pendingTab=''">Keep editing</button><button class="sheet-button" @click="discardAndSwitch">Discard draft & change tab</button></div></section>
        <p v-if="store.saveError" class="sheet-alert" role="alert">{{ store.saveError }} Your last saved values are still shown.</p>
        <p v-if="pendingRules" class="sheet-notice">Saved class rules changed while you were editing. Your draft is kept; saving it will apply the latest rules and flag conflicts.</p><WorkshopRuleReview v-if="store.canEditPermanent" @edit="editSection='rules';switchTab('edit')" />
        <p v-if="library.warning.value" class="sheet-notice">{{ library.warning.value }}</p>
        <p v-else-if="library.loading.value" class="sheet-refresh-status" role="status">Saved sheet is ready. Refreshing rules and reference details…</p>
        </template>
        <section v-if="active==='summary'" class="sheet-summary-tab"><CharacterSummary v-if="appearance.sheetLayout==='folio'" @edit="switchTab('edit')" /><CharacterSidebar v-else @edit="switchTab('edit')" /></section><section v-else-if="active==='champions'&&championClass" class="sheet-panel"><ShadowChampions :level="championClass.level" :room-id="roomId" :character-id="id" /></section><CombatTab v-else-if="active === 'combat'" @repair-spell="openSpellRepair" /><SpellbookPanel v-else-if="active === 'spells'" @repair="openSpellRepair" /><EquipmentSpellsTab v-else-if="active === 'equipment'" /><FeaturesTab v-else-if="active === 'features'" /><CoreTab v-else-if="active === 'proficiencies'" /><BioTab v-else-if="active === 'bio'" /><CharacterEditTab v-else-if="store.canEditPermanent" :initial-section="editSection" :repair-spell="repairSpell" :repair-open="repairOpen" @dirty="editDirty=$event" @saved="editDirty=false;active = 'combat'" />
        <template #footer><details class="sheet-loading-status"><summary>Loading status</summary><p>Saved sheet opened in {{(store.lastOpenMs/1000).toFixed(2)}} seconds.</p><p>{{library.loading.value?'Rules and reference details are still refreshing.':`Rules and reference check: ${(library.lastReferenceMs.value/1000).toFixed(2)} seconds.`}}</p><button v-if="library.warning.value" type="button" class="sheet-button sheet-small-button" :disabled="library.loading.value" @click="library.reload">Retry reference details</button></details></template>
      </CharacterSheetFrame>
    </div>
    <p v-else class="sheet-empty" role="status">Opening your character…</p>
  </div>
</template>
