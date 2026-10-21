<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import WorkshopRuleReview from '../components/workshop/WorkshopRuleReview.vue'
import { useRoute, RouterLink, onBeforeRouteLeave } from 'vue-router'
import { useCharactersStore, type Character } from '../stores/characters'
import { provideSheetLibrary } from '../composables/useSheetLibrary'
import CharacterSummary from '../components/sheet/CharacterSummary.vue'
import CharacterSidebar from '../components/sheet/CharacterSidebar.vue'
import CharacterSheetFrame from '../components/sheet/CharacterSheetFrame.vue'
import SheetLoadingStatus from '../components/sheet/SheetLoadingStatus.vue'
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
import NotebookShortcut from '../components/notebook/NotebookShortcut.vue'
import { progressionClasses } from '../../shared/character-progression'
import { isRevenantShadow } from '../../shared/class-rules'
const route = useRoute(), store = useCharactersStore()
const props = defineProps<{ characterId?: string; roomId?: string; role?: 'dm' | 'player'; compactSummary?:boolean; playerPreview?:boolean;championFor?:string;embedded?:boolean;initialSection?:string }>()
const emit = defineEmits<{ ready: [id: string]; settled: [id: string]; 'section-change': [section: string]; 'open-notebook': [characterId: string] }>()
const id = computed(() => props.characterId ?? String(route.params.id))
const c = computed(() => store.current as Character)
const championClass=computed(()=>c.value?progressionClasses(c.value).find(entry=>isRevenantShadow(entry.name)):undefined)
const library = provideSheetLibrary(c)
const {appearance}=useBuilderAppearance()
const active = ref('combat'), loadError = ref('')
watch(()=>appearance.sheetLayout,layout=>{if(layout==='classic'&&!props.compactSummary&&active.value==='summary')active.value='combat'})
const editSection=ref('identity'),repairSpell=ref(''),repairOpen=ref(false),sheetMain=ref<HTMLElement|null>(null)
const editDirty = ref(false), pendingTab = ref(''),pendingRules=ref(false)
watch(active,value=>{store.editing=value==='edit';emit('section-change',value)},{immediate:true})
watch(()=>store.rulesPending,value=>{if(value)pendingRules.value=true})
let refreshingRules=false,disposed=false
async function refreshRules(){if(refreshingRules||store.roomContext?.preview||store.loading)return;if(editDirty.value){pendingRules.value=true;return}if(store.saving||!store.current)return;refreshingRules=true;try{await store.fetchOne(id.value,{quick:true});await library.reload();pendingRules.value=false}catch{/* Existing character stays usable. */}finally{refreshingRules=false}}
const storageRefresh=(event:StorageEvent)=>{if(event.key==='codex:workshop-revision')void refreshRules()}
const focusRefresh=()=>{if(!props.roomId&&document.visibilityState==='visible')void refreshRules()}
onMounted(()=>{window.addEventListener('codex:workshop-published',refreshRules);window.addEventListener('focus',focusRefresh);window.addEventListener('storage',storageRefresh);document.addEventListener('visibilitychange',focusRefresh)})
onUnmounted(()=>{disposed=true;store.editing=false;window.removeEventListener('codex:workshop-published',refreshRules);window.removeEventListener('focus',focusRefresh);window.removeEventListener('storage',storageRefresh);document.removeEventListener('visibilitychange',focusRefresh)})
function openSpellRepair(index=''){editSection.value='spells';repairSpell.value=index;repairOpen.value=true;switchTab('edit')}
function showTab(key:string){active.value=key;if(!props.embedded)void nextTick(()=>sheetMain.value?.scrollIntoView({block:'start'}))}
function switchTab(key: string) { if (key === active.value) return; if (editDirty.value) pendingTab.value = key; else showTab(key) }
function discardAndSwitch() { editDirty.value = false; showTab(pendingTab.value); pendingTab.value = '' }
onBeforeRouteLeave(() => !editDirty.value || window.confirm('Discard your unsaved character edits and leave this page?'))
const tabs = computed(() => [...(props.compactSummary||appearance.sheetLayout==='folio'?[{key:'summary',label:'Summary'}]:[]),{ key: 'combat', label: 'Combat' }, { key: 'spells', label: 'Spells' }, { key: 'equipment', label: 'Equipment' }, { key: 'features', label: 'Features' }, { key: 'proficiencies', label: 'Proficiencies' }, { key: 'bio', label: 'Bio & notes' },...(championClass.value&&!props.championFor?[{key:'champions',label:'Shadow Champions'}]:[]), ...(store.canEditPermanent ? [{ key: 'edit', label: 'Edit character' }] : [])])
async function openCharacter(){const requested=id.value;loadError.value='';try{await store.fetchOne(requested,{quick:true});if(!disposed&&id.value===requested&&store.current?._id===requested)emit('ready',requested)}catch(error){if(!disposed&&id.value===requested)loadError.value=error instanceof Error?error.message:'Could not open this character. Try again.'}finally{if(!disposed&&id.value===requested)emit('settled',requested)}}
watch(() => [id.value, props.roomId, props.role,props.playerPreview,props.championFor] as const, async () => {
  store.roomContext = props.roomId ? { roomId: props.roomId, role: props.role ?? 'player',preview:props.playerPreview,championFor:props.championFor } : null
  editDirty.value=false;pendingTab.value='';pendingRules.value=false;repairOpen.value=false;repairSpell.value='';editSection.value='identity'
  active.value = tabs.value.some(tab=>tab.key===props.initialSection&&tab.key!=='edit')?props.initialSection!:(props.compactSummary?'summary':'combat'); loadError.value = ''; store.current = null
  await openCharacter()
}, { immediate: true })
function discardEdits(){editDirty.value=false;pendingTab.value='';active.value='summary'}
function reviewRules(){editSection.value='rules';switchTab('edit')}
defineExpose({ editDirty,retryOpen:openCharacter,discardEdits,reviewRules })
</script>
<template>
  <div class="hero-sheet">
    <div class="sheet-page-top"><RouterLink v-if="championFor" :to="`/rooms/${roomId}`">← Game room</RouterLink><RouterLink v-else-if="!roomId&&!embedded" to="/">← Your characters</RouterLink><span>{{ role === 'player' ? 'PLAYER SHEET · PERMANENT EDITING BY DM' : 'CHARACTER SHEET · 2014 RULES' }}</span><span role="status">{{ playerPreview ? 'Temporary preview · changes are not saved' : store.saving ? 'Saving…' : 'Changes save automatically during play' }}</span><button v-if="roomId&&!championFor" type="button" class="sheet-button sheet-small-button" :disabled="store.saving" @click="emit('open-notebook',id)">Open notebook</button><NotebookShortcut v-else-if="!championFor" :character-id="id" :disabled="store.saving||editDirty" /></div>
    <p v-if="championFor" class="sheet-notice">Shadow Champion reference sheet. You can inspect every tab and try resources here; changes in this preview are temporary.</p><p v-if="loadError" class="sheet-alert" role="alert">{{ loadError }} <button type="button" class="sheet-button sheet-small-button" :disabled="store.loading" @click="openCharacter">Try again</button></p>
    <div v-else-if="c" ref="sheetMain">
      <CharacterSheetFrame :active="active" :tabs="tabs" :compact-summary="compactSummary" @select="switchTab" @edit="switchTab('edit')">
        <template #status>
        <section v-if="pendingTab" class="sheet-panel" role="alertdialog" aria-label="Unsaved character edits" style="margin-bottom:20px"><h3>Keep your edits?</h3><p class="sheet-small">Your character has unsaved changes. Save them in Edit, or discard the draft to change tabs.</p><div class="sheet-filter-buttons" style="margin-top:14px"><button class="sheet-button" @click="pendingTab=''">Keep editing</button><button class="sheet-button" @click="discardAndSwitch">Discard draft & change tab</button></div></section>
        <p v-if="store.saveError" class="sheet-alert" role="alert">{{ store.saveError }} Your last saved values are still shown.</p>
        <p v-if="pendingRules" class="sheet-notice">Saved class rules changed while you were editing. Your draft is kept; saving it will apply the latest rules and flag conflicts.</p><WorkshopRuleReview v-if="store.canEditPermanent&&!(roomId&&role==='dm')" @edit="reviewRules" />
        <p v-if="library.warning.value" class="sheet-notice">{{ library.warning.value }}</p>
        <p v-else-if="library.loading.value" class="sheet-refresh-status" role="status">Saved sheet is ready. Refreshing rules and reference details…</p>
        </template>
        <section v-if="active==='summary'" class="sheet-summary-tab"><CharacterSummary v-if="appearance.sheetLayout==='folio'" /><CharacterSidebar v-else @edit="switchTab('edit')" /></section><section v-else-if="active==='champions'&&championClass" class="sheet-panel"><ShadowChampions :level="championClass.level" :room-id="roomId" :character-id="id" /></section><CombatTab v-else-if="active === 'combat'" @repair-spell="openSpellRepair" /><SpellbookPanel v-else-if="active === 'spells'" @repair="openSpellRepair" /><EquipmentSpellsTab v-else-if="active === 'equipment'" /><FeaturesTab v-else-if="active === 'features'" /><CoreTab v-else-if="active === 'proficiencies'" /><BioTab v-else-if="active === 'bio'" /><CharacterEditTab v-else-if="store.canEditPermanent" :initial-section="editSection" :repair-spell="repairSpell" :repair-open="repairOpen" @dirty="editDirty=$event" @saved="editDirty=false;active = 'combat'" />
        <template #footer><SheetLoadingStatus :loading="library.loading.value" :reference-ms="library.lastReferenceMs.value" :source="library.referenceSource.value" :warning="!!library.warning.value" @reload="library.reload" /></template>
      </CharacterSheetFrame>
    </div>
    <p v-else class="sheet-empty" role="status">Opening your character…</p>
  </div>
</template>
