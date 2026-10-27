<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useCharactersStore, type Character } from '../stores/characters'
import { useAuthStore } from '../stores/auth'
import CharacterLinkImport from '../components/CharacterLinkImport.vue'
import CharacterRoster from '../components/characters/CharacterRoster.vue'
import CharacterFolders from '../components/characters/CharacterFolders.vue'
import { useCharacterLibrary } from '../composables/useCharacterLibrary'
import { folderLabel, type LibraryAction } from '../../shared/character-library'
import { api } from '../lib/api'
import { cancelMotionWithin, vMotionCharacter } from '../directives/siteMotion'
import { useCharacterSwitchScroll } from '../composables/useCharacterSwitchScroll'
import '../dashboard.css'

const CharacterSheetView = defineAsyncComponent(() => import('./CharacterSheetView.vue'))
const store = useCharactersStore(), auth = useAuthStore(), router = useRouter(), route = useRoute()
const sheet = ref<{ editDirty: boolean } | null>(null), motionHost = ref<HTMLElement | null>(null)
const switchScroll = useCharacterSwitchScroll(motionHost)
const fileInput = ref<HTMLInputElement | null>(null), actionsMenu = ref<HTMLDetailsElement | null>(null)
const listReady = ref(false), listBusy = ref(false), listError = ref(''), actionError = ref('')
const importBusy = ref(false), linkSaving = ref(false), actionBusy = ref(false), importMessage = ref('')
const showLinkImport = ref(false), importOpened = ref(false), query = ref(''), collapsed = ref(false)
const selectedId = ref(''), motionSequence = ref(0), animateWhenReady = ref('')
const sections = new Map<string, string>()
const preferenceKey = `codex:dashboard-workspace:v1:${auth.user?.id ?? 'anonymous'}`
const folderLayout = ref<'tree' | 'shelf'>('tree')
const folders = useCharacterLibrary(), folder = ref('all'), checked = ref<string[]>([]), dragging = ref(false), draggedIds = ref<string[]>([]), moveTo = ref(''), organizing = ref(false)
const folderPreferenceKey = `codex:character-folders:v1:${auth.user?.id ?? 'anonymous'}`
try { folder.value = localStorage.getItem(folderPreferenceKey) || 'all' } catch { /* Browsing preferences are optional. */ }
watch(folder, value => { checked.value = []; try { localStorage.setItem(folderPreferenceKey, value) } catch { /* Keep browsing usable. */ } })
const folderCharacters = computed(() => characters.value.filter(c => folder.value === 'all' || (folders.folderOf(c._id) ?? 'unfiled') === folder.value))
const visibleCharacters = computed(() => folderCharacters.value.filter(c => `${c.meta.name} ${c.meta.race} ${c.meta.klass}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const currentFolderLabel = computed(() => folder.value === 'all' ? 'All characters' : folder.value === 'unfiled' ? 'Unfiled' : folderLabel(folders.library.value.folders, folder.value))
const folderOptions = computed(() => folders.library.value.folders.map(f => ({ id: f.id, label: folderLabel(folders.library.value.folders, f.id) })).sort((a,b) => a.label.localeCompare(b.label)))
const selectedOutsideFolder = computed(() => selected.value && !folderCharacters.value.some(c => c._id === selectedId.value))
watch(() => folders.library.value, value => { if (folders.ready.value && !['all','unfiled'].includes(folder.value) && !value.folders.some(f => f.id === folder.value)) folder.value = 'all' })
function navigateFolder(id: string) { folder.value = id; query.value = '' }
function checkCharacter(id: string) { if (!checked.value.includes(id) && checked.value.length >= 200) { folders.error.value = 'Select up to 200 characters for one move.'; return } checked.value = checked.value.includes(id) ? checked.value.filter(c => c !== id) : [...checked.value, id] }
function dragCharacter(id: string, event: DragEvent) {
 if (folders.locked.value || busy.value || !event.dataTransfer) { event.preventDefault(); return }
 draggedIds.value = checked.value.includes(id) ? [...checked.value] : [id]; dragging.value = true
 event.dataTransfer.setData('application/x-codex-character', JSON.stringify(draggedIds.value)); event.dataTransfer.effectAllowed = 'move'
}
function dragEnd() { dragging.value = false; draggedIds.value = [] }
async function moveCharacters(ids: string[], destination: string | null) {
 if (!ids.length || busy.value) return
 if (await folders.change({ type: 'move', characterIds: ids, folderId: destination })) checked.value = []
 dragEnd()
}
function dropCharacters(destination: string | null) { void moveCharacters([...draggedIds.value], destination) }
async function changeFolder(action: LibraryAction) { if (!busy.value) await folders.change(action) }
const characters = computed(() => listReady.value ? store.list : [])
const selected = computed(() => characters.value.find(c => c._id === selectedId.value))
const busy = computed(() => store.saving || importBusy.value || linkSaving.value || actionBusy.value || folders.saving.value)
const currentSection = computed(() => sections.get(selectedId.value) ?? 'summary')
try {
  const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}')
  collapsed.value = saved.collapsed === true
} catch { /* Device preferences must not prevent opening the dashboard. */ }
watch(collapsed, () => {
  try { localStorage.setItem(preferenceKey, JSON.stringify({ collapsed: collapsed.value })) } catch { /* Keep the current session usable. */ }
})
// Reflect saved identity edits in the roster before moving to another sheet.
watch(() => store.current, character => {
  if (!character || character._id !== selectedId.value || store.roomContext) return
  const index = store.list.findIndex(c => c._id === character._id)
  if (index >= 0) store.list[index] = { ...store.list[index]!, meta: { ...character.meta }, updatedAt: character.updatedAt, companionKind: character.companionKind }
})
function closeActions() { if (actionsMenu.value) actionsMenu.value.open = false }
function maySwitch(destination = 'open another character') {
  if (busy.value) { importMessage.value = 'Please wait for the current save or import to finish.'; return false }
  return !sheet.value?.editDirty || window.confirm(`Discard your unsaved character edits and ${destination}?`)
}
function openCharacter(id: string, animate = true) {
  if (selectedId.value && selectedId.value !== id) switchScroll.begin()
  cancelMotionWithin(motionHost.value)
  animateWhenReady.value = animate ? id : ''
  selectedId.value = id
  closeActions()
}
function selectCharacter(id: string) {
  if (id === selectedId.value || !maySwitch()) return
  if (!selectedId.value) libraryScroll = window.scrollY
  actionError.value = ''; importMessage.value = ''
  openCharacter(id)
  void nextTick(() => { document.getElementById('dashboard-back-folders')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) })
}
let libraryScroll = 0
async function backToFolders() {
  if (!maySwitch('return to folders')) return
  const id = selectedId.value
  openCharacter('', false)
  await nextTick()
  const target = document.querySelector<HTMLElement>(`.dashboard-folder-sidebar [data-character-id="${id}"]`) ?? document.getElementById('dashboard-browse-hint')
  target?.focus({ preventScroll: true })
  window.scrollTo({ top: libraryScroll, behavior: 'instant' })
}
async function sheetReady(id: string) {
  if (selectedId.value !== id || animateWhenReady.value !== id) return
  animateWhenReady.value = ''
  await nextTick()
  if (selectedId.value === id) motionSequence.value++
}
function sheetSettled(id: string) { if (selectedId.value === id) void switchScroll.finish() }
function rememberSection(value: string) { sections.set(selectedId.value, value === 'edit' ? 'summary' : value) }
async function loadCharacters() {
  if (listBusy.value) return
  listBusy.value = true; listError.value = ''
  try {
    await store.fetchList()
    listReady.value = true
    const requested = typeof route.query.character === 'string' ? route.query.character : selectedId.value
    const id = store.list.find(c => c._id === requested)?._id ?? ''
    openCharacter(id, false)
    if ('character' in route.query) {
      const cleanQuery = { ...route.query }; delete cleanQuery.character
      await router.replace({ query: cleanQuery })
    }
  } catch (error) { listError.value = error instanceof Error ? error.message : 'Could not load your characters. Please try again.' }
  finally { listBusy.value = false }
}
onMounted(() => { void loadCharacters(); void folders.load() })
onBeforeRouteLeave(() => {
  if (!busy.value) return true
  importMessage.value = 'Please wait for the current save or import before leaving this page.'
  return false
})
function onCreate() { closeActions(); void router.push({ name: 'character-new', query: { from: 'dashboard' } }) }
async function closeImport() {
  if (linkSaving.value) return
  showLinkImport.value = false
  await nextTick()
  document.getElementById('dashboard-import-toggle')?.focus({ preventScroll: true })
}
function toggleImport() {
  if (linkSaving.value) return
  if (showLinkImport.value) void closeImport()
  else { importOpened.value = true; showLinkImport.value = true }
}
function imported(character: Character) {
  linkSaving.value = false; showLinkImport.value = false; query.value = ''
  importMessage.value = `${character.meta.name || 'Character'} imported. Its sheet is open below.`
  openCharacter(character._id)
}
async function onDuplicate() {
  const character = selected.value
  if (!character || !maySwitch()) return
  closeActions(); actionBusy.value = true; actionError.value = ''
  try { const copy = await store.duplicate(character._id); query.value = ''; openCharacter(copy._id) }
  catch (error) { actionError.value = error instanceof Error ? error.message : 'Could not duplicate the character.' }
  finally { actionBusy.value = false }
}
async function onDelete() {
  const character = selected.value
  if (!character || busy.value) return
  const edits = sheet.value?.editDirty ? ' Its unsaved edits will also be discarded.' : ''
  if (!window.confirm(`Delete ${character.meta.name || 'this character'} permanently?${edits}`)) return
  closeActions(); actionBusy.value = true; actionError.value = ''
  try {
    await store.remove(character._id)
    sections.delete(character._id)
    openCharacter('', false)
    if (!selectedId.value) store.current = null
  } catch (error) { actionError.value = error instanceof Error ? error.message : 'Could not delete the character.' }
  finally { actionBusy.value = false }
}
function onExport() {
  const character = selected.value
  if (!character) return
  closeActions()
  const link = document.createElement('a')
  link.href = `/api/characters/${character._id}/export`
  link.download = `${(character.meta.name || 'character').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`
  link.click()
}
function triggerImport() { if (!busy.value) fileInput.value?.click() }
async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  if (!maySwitch()) { input.value = ''; return }
  importBusy.value = true; importMessage.value = ''; actionError.value = ''
  try {
    const data = JSON.parse(await file.text())
    if (['codex-public-migration', 'codex-of-heroes-backup'].includes(data?.format)) {
      if (!window.confirm(`Restore ${data.characters?.length ?? 0} characters and ${data.content?.length ?? 0} content entries into this account? The account must be empty; no existing data will be overwritten.`)) return
      const restored = await api.post<{ characters: number; content: number }>('/api/library-restore', data)
      await store.fetchList()
      listReady.value = true; query.value = ''
      openCharacter('', false)
      importMessage.value = `Restored ${restored.characters} characters and ${restored.content} content entries.`
    } else imported(await store.importCharacter(data))
  } catch (error) { actionError.value = error instanceof Error ? error.message : 'That file could not be imported.' }
  finally { input.value = ''; importBusy.value = false }
}
</script>

<template>
  <div class="dashboard-page dashboard-library">
    <header class="dashboard-heading">
      <div><h1>Your characters</h1><p>Your roster and character sheet, organised by campaign.</p></div>
      <div class="dashboard-actions">
        <button id="dashboard-import-toggle" type="button" class="btn-ghost" :disabled="importBusy || linkSaving || actionBusy" :aria-expanded="showLinkImport" aria-controls="dashboard-import-panel" @click="toggleImport">Import character link</button>
        <button type="button" class="btn-ghost" :disabled="busy" @click="triggerImport">{{ importBusy ? 'Importing…' : 'Import JSON / backup' }}</button>
        <button type="button" class="btn-primary" :disabled="busy" @click="onCreate">New character</button>
      </div>
      <input ref="fileInput" class="hidden" type="file" accept="application/json,.json" aria-label="Import character JSON or backup" @change="onImportFile" />
    </header>
    <div id="dashboard-import-panel" class="dashboard-import-drawer" :data-open="showLinkImport">
      <div class="dashboard-import-content" :inert="!showLinkImport" :aria-hidden="!showLinkImport">
        <CharacterLinkImport v-if="importOpened" stay-on-page :before-import="maySwitch" @saving="linkSaving = $event" @imported="imported" @close="closeImport" />
      </div>
    </div>
    <p v-if="importMessage" class="dashboard-message" role="status">{{ importMessage }}</p>
    <p v-if="actionError" class="dashboard-error" role="alert">{{ actionError }}</p>
    <p v-if="listError" class="dashboard-error" role="alert">{{ listError }} <button type="button" class="btn-ghost" :disabled="listBusy" @click="loadCharacters">Retry</button></p>
    <p v-if="folders.error.value" class="dashboard-error" role="alert">{{ folders.error.value }} <button type="button" class="btn-ghost" :disabled="folders.loading.value||folders.saving.value" @click="folders.load">Reload folders</button></p>
    <p v-if="folders.notice.value" class="dashboard-message" role="status">{{ folders.notice.value }}</p>
    <CharacterFolders v-if="folderLayout==='shelf'&&listReady" :library="folders.library.value" :characters="characters" :current="folder" layout="shelf" :disabled="busy||folders.locked.value" :dragging="dragging" @navigate="navigateFolder" @change="changeFolder" @drop-characters="dropCharacters" />
    <div v-if="listReady" class="dashboard-folder-toolbar">
      <div><strong>{{ currentFolderLabel }}</strong><small>{{ folderCharacters.length }} characters</small><span v-if="folders.loading.value">Loading folders…</span><span v-if="folders.saving.value" role="status">Saving folders…</span></div>
      <button type="button" class="btn-ghost" :aria-expanded="organizing" aria-controls="dashboard-move-tools" @click="organizing=!organizing;checked=[]">{{ organizing?'Done organising':'Organise' }}</button>
      <div v-if="organizing" id="dashboard-move-tools" class="dashboard-move-tools"><button type="button" class="btn-ghost" :disabled="!visibleCharacters.length||busy||folders.locked.value" @click="checked=visibleCharacters.slice(0,200).map(c=>c._id)">Select visible</button><button v-if="checked.length" type="button" class="btn-ghost" @click="checked=[]">Clear {{ checked.length }} selected</button><label class="sr-only" for="dashboard-folder-destination">Move destination</label><select id="dashboard-folder-destination" v-model="moveTo" :disabled="busy||folders.locked.value"><option value="">Unfiled</option><option v-for="option in folderOptions" :key="option.id" :value="option.id">{{ option.label }}</option></select><button type="button" class="btn-ghost" :disabled="(!checked.length&&!selectedId)||busy||folders.locked.value" @click="moveCharacters(checked.length?[...checked]:[selectedId],moveTo||null)">{{ checked.length?`Move ${checked.length} selected`:'Move open character' }}</button></div>
    </div>
    <p v-if="listReady&&!selectedId" id="dashboard-browse-hint" tabindex="-1" class="dashboard-browse-hint">Choose a folder, then open a character to view their sheet.</p>
    <div v-if="listReady" class="character-workspace dashboard-workspace" :data-browsing="!selectedId" :data-collapsed="!!selectedId&&collapsed" :data-folders="folderLayout">
      <div class="dashboard-folder-sidebar" :data-collapsed="!!selectedId&&collapsed"><CharacterRoster v-model:query="query" :characters="folderCharacters" :selected-id="selectedId" :collapsed="!!selectedId&&collapsed" :disabled="busy" :organize="organizing" allow-drag :checked="checked" @check="checkCharacter" @drag-character="dragCharacter" @drag-end="dragEnd" @toggle="collapsed = !collapsed" @select="selectCharacter"><template v-if="folderLayout==='tree'" #folders><CharacterFolders :library="folders.library.value" :characters="characters" :current="folder" layout="tree" :disabled="busy||folders.locked.value" :dragging="dragging" @navigate="navigateFolder" @change="changeFolder" @drop-characters="dropCharacters" /></template><template #empty><p>{{ query?'No characters match this search.':!characters.length?'Create or import your first character.':'This folder has no characters yet. Drag characters here or use Organise to move them.' }}</p><button v-if="query" type="button" class="btn-ghost" @click="query=''">Clear search</button></template></CharacterRoster></div>
      <section v-if="selectedId" class="dashboard-selected" aria-label="Selected character sheet">
        <button id="dashboard-back-folders" type="button" class="btn-ghost dashboard-back-folders" :disabled="busy" @click="backToFolders">‹ Back to folders</button>
        <p v-if="selectedOutsideFolder" class="dashboard-folder-location">Open sheet: {{ folders.labelOf(selectedId) }} <button type="button" @click="navigateFolder(folders.folderOf(selectedId)||'unfiled')">Show its folder</button></p>
        <div v-if="selected" class="dashboard-sheet-tools">
          <span>{{ selected?.meta.name || 'Character sheet' }}</span>
          <div class="dashboard-actions"><RouterLink v-if="selected" :to="`/characters/${selected._id}`" class="dashboard-open-page">Open sheet page</RouterLink><details ref="actionsMenu" class="dashboard-character-actions" @keydown.esc.stop="closeActions"><summary>Character actions</summary><div><button type="button" :disabled="busy" @click="onDuplicate">Duplicate</button><button type="button" :disabled="busy" @click="onExport">Export saved character</button><button type="button" :disabled="busy" @click="onDelete">Delete character</button></div></details></div>
        </div>
        <div ref="motionHost" v-motion-character="motionSequence" class="character-sheet-container character-sheet-motion">
          <CharacterSheetView v-if="selectedId" ref="sheet" :character-id="selectedId" :initial-section="currentSection" compact-summary embedded @ready="sheetReady" @settled="sheetSettled" @section-change="rememberSection" />
          <section v-else class="panel dashboard-empty"><h2>No characters yet.</h2><p>Create or import a character with the controls above. Your folders are ready when you are.</p></section>
        </div>
      </section>
    </div>
    <p v-else-if="listBusy" class="dashboard-empty" role="status">Loading your character library…</p>
  </div>
</template>
