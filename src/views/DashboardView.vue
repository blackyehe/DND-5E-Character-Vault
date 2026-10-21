<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useCharactersStore, type Character } from '../stores/characters'
import { useAuthStore } from '../stores/auth'
import CharacterLinkImport from '../components/CharacterLinkImport.vue'
import CharacterRoster from '../components/characters/CharacterRoster.vue'
import { api } from '../lib/api'
import { cancelMotionWithin, vMotionCharacter } from '../directives/siteMotion'
import '../dashboard.css'

const CharacterSheetView = defineAsyncComponent(() => import('./CharacterSheetView.vue'))
const store = useCharactersStore(), auth = useAuthStore(), router = useRouter(), route = useRoute()
const sheet = ref<{ editDirty: boolean } | null>(null), motionHost = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null), actionsMenu = ref<HTMLDetailsElement | null>(null)
const listReady = ref(false), listBusy = ref(false), listError = ref(''), actionError = ref('')
const importBusy = ref(false), linkSaving = ref(false), actionBusy = ref(false), importMessage = ref('')
const showLinkImport = ref(false), importOpened = ref(false), query = ref(''), collapsed = ref(false)
const selectedId = ref(''), motionSequence = ref(0), animateWhenReady = ref('')
const sections = new Map<string, string>()
const preferenceKey = `codex:dashboard-workspace:v1:${auth.user?.id ?? 'anonymous'}`
const characters = computed(() => listReady.value ? store.list : [])
const selected = computed(() => characters.value.find(c => c._id === selectedId.value))
const busy = computed(() => store.saving || importBusy.value || linkSaving.value || actionBusy.value)
const currentSection = computed(() => sections.get(selectedId.value) ?? 'summary')
let preferredId = ''
try {
  const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}')
  if (typeof saved.selected === 'string') preferredId = saved.selected
  collapsed.value = saved.collapsed === true
} catch { /* Device preferences must not prevent opening the dashboard. */ }
watch([selectedId, collapsed], () => {
  try { localStorage.setItem(preferenceKey, JSON.stringify({ selected: selectedId.value, collapsed: collapsed.value })) } catch { /* Keep the current session usable. */ }
})
// Reflect saved identity edits in the roster before moving to another sheet.
watch(() => store.current, character => {
  if (!character || character._id !== selectedId.value || store.roomContext) return
  const index = store.list.findIndex(c => c._id === character._id)
  if (index >= 0) store.list[index] = { ...store.list[index]!, meta: { ...character.meta }, updatedAt: character.updatedAt, companionKind: character.companionKind }
})
function closeActions() { if (actionsMenu.value) actionsMenu.value.open = false }
function maySwitch() {
  if (busy.value) { importMessage.value = 'Please wait for the current save or import to finish.'; return false }
  return !sheet.value?.editDirty || window.confirm('Discard your unsaved character edits and open another character?')
}
function openCharacter(id: string, animate = true) {
  cancelMotionWithin(motionHost.value)
  animateWhenReady.value = animate ? id : ''
  selectedId.value = id
  closeActions()
}
function selectCharacter(id: string) {
  if (id === selectedId.value || !maySwitch()) return
  actionError.value = ''; importMessage.value = ''
  openCharacter(id)
}
async function sheetReady(id: string) {
  if (selectedId.value !== id || animateWhenReady.value !== id) return
  animateWhenReady.value = ''
  await nextTick()
  if (selectedId.value === id) motionSequence.value++
}
function rememberSection(value: string) { sections.set(selectedId.value, value === 'edit' ? 'summary' : value) }
async function loadCharacters() {
  if (listBusy.value) return
  listBusy.value = true; listError.value = ''
  try {
    await store.fetchList()
    listReady.value = true
    const requested = typeof route.query.character === 'string' ? route.query.character : preferredId
    const id = store.list.find(c => c._id === requested)?._id ?? store.list[0]?._id ?? ''
    openCharacter(id, false)
    if ('character' in route.query) {
      const cleanQuery = { ...route.query }; delete cleanQuery.character
      await router.replace({ query: cleanQuery })
    }
  } catch (error) { listError.value = error instanceof Error ? error.message : 'Could not load your characters. Please try again.' }
  finally { listBusy.value = false }
}
onMounted(loadCharacters)
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
    openCharacter(store.list[0]?._id ?? '')
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
      openCharacter(store.list[0]?._id ?? '')
      importMessage.value = `Restored ${restored.characters} characters and ${restored.content} content entries.`
    } else imported(await store.importCharacter(data))
  } catch (error) { actionError.value = error instanceof Error ? error.message : 'That file could not be imported.' }
  finally { input.value = ''; importBusy.value = false }
}
</script>

<template>
  <div class="dashboard-page dashboard-library">
    <header class="dashboard-heading">
      <div><h1>Your characters</h1><p>Your roster and character sheet, side by side.</p></div>
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
    <div v-if="listReady && characters.length" class="character-workspace dashboard-workspace" :data-collapsed="collapsed">
      <CharacterRoster v-model:query="query" :characters="characters" :selected-id="selectedId" :collapsed="collapsed" :disabled="busy" @toggle="collapsed = !collapsed" @select="selectCharacter" />
      <section class="dashboard-selected" aria-label="Selected character sheet">
        <div class="dashboard-sheet-tools">
          <span>{{ selected?.meta.name || 'Character sheet' }}</span>
          <div class="dashboard-actions"><RouterLink v-if="selected" :to="`/characters/${selected._id}`" class="dashboard-open-page">Open sheet page</RouterLink><details ref="actionsMenu" class="dashboard-character-actions" @keydown.esc.stop="closeActions"><summary>Character actions</summary><div><button type="button" :disabled="busy" @click="onDuplicate">Duplicate</button><button type="button" :disabled="busy" @click="onExport">Export saved character</button><button type="button" :disabled="busy" @click="onDelete">Delete character</button></div></details></div>
        </div>
        <div ref="motionHost" v-motion-character="motionSequence" class="character-sheet-container character-sheet-motion">
          <CharacterSheetView v-if="selectedId" ref="sheet" :character-id="selectedId" :initial-section="currentSection" compact-summary embedded @ready="sheetReady" @section-change="rememberSection" />
        </div>
      </section>
    </div>
    <p v-else-if="listBusy" class="dashboard-empty" role="status">Loading your character library…</p>
    <section v-else-if="listReady" class="panel dashboard-empty"><h2>No characters yet.</h2><p>Create a character or import one using the controls above.</p></section>
  </div>
</template>
