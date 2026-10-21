<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {api, ApiError} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import {vMotionPanel} from '../../directives/siteMotion'
import type {NotebookDraft, NotebookEntry, NotebookFolder, NotebookIndex, NotebookSection, NotebookSummary, NotebookVersion} from '../../../shared/notebook'
import NotebookText from './NotebookText.vue'
import './notebook.css'

const props = defineProps<{roomId: string; previewCharacter?: string; initialCharacter?: string}>()
const auth = useAuthStore(), section = ref<NotebookSection>('journal'), index = ref<NotebookIndex | null>(null)
const selected = ref<NotebookEntry | null>(null), editing = ref(false), draft = ref<NotebookDraft | null>(null), baseline = ref('')
const loading = ref(false), opening = ref(false), busy = ref(false), error = ref(''), notice = ref(''), remote = ref<NotebookEntry | null>(null)
const search = ref(''), folder = ref('all'), relevant = ref(props.initialCharacter ?? ''), trash = ref(false), browse = ref(true)
const folderTitle = ref(''), newFolderOpen = ref(false), renameTitle = ref(''), folderTools = ref(false)
const historyOpen = ref(false), versions = ref<NotebookVersion[]>([]), historyBefore = ref<number | null>(null), historyBusy = ref(false)
const linkQuery = ref(''), linkResults = ref<NotebookSummary[]>([]), linkBusy = ref(false), textArea = ref<HTMLTextAreaElement | null>(null)
const pinned = ref<string[]>([]), pinnedEntries = ref<NotebookSummary[]>([]), labels = ref<Record<string, string>>({})
let generation = 0, listRun = 0, openRun = 0, linkRun = 0, pinRun = 0, disposed = false
let poll: ReturnType<typeof setInterval>, searchTimer: ReturnType<typeof setTimeout>, linkTimer: ReturnType<typeof setTimeout>
const dirty = computed(() => editing.value && !!draft.value && (!selected.value || JSON.stringify(draft.value) !== baseline.value))
const readOnly = computed(() => !!props.previewCharacter || !!index.value?.readOnly)
const canManage = computed(() => !!index.value && !readOnly.value && (index.value.role === 'dm' || section.value === 'journal'))
const activeFolder = computed(() => index.value?.folders.find(item => item.id === folder.value))
const activeFolders = computed(() => index.value?.folders.filter(item => !item.deletedAt) ?? [])
const folderList = computed(() => index.value?.folders.filter(item => trash.value ? !!item.deletedAt : !item.deletedAt) ?? [])
const pinKey = computed(() => `codex:notebook-pins:v1:${auth.user?.id ?? 'anonymous'}:${props.roomId}`)
const date = (value: string) => new Date(value).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'})
const audienceLabel = (entry: NotebookSummary) => entry.audience === 'dm' ? 'DM only' : entry.audience === 'room' ? 'Whole room' : 'Selected characters'
function path(tail = '', query: Record<string, string> = {}) {const values = new URLSearchParams(query); if (props.previewCharacter) values.set('previewCharacter', props.previewCharacter); return `/api/rooms/${props.roomId}/notebook${tail}${values.size ? '?' + values : ''}`}
function rememberLabels(values: {id: string; title: string}[]) {for (const item of values) labels.value[item.id] = item.title}
function clearPrivate() {index.value = null; selected.value = null; draft.value = null; editing.value = false; opening.value = false; remote.value = null; versions.value = []; pinnedEntries.value = []; linkResults.value = []; labels.value = {}}
function failure(value: unknown) {error.value = value instanceof Error ? value.message : 'The notebook could not be updated. Try Refresh.'; if (value instanceof ApiError && [401, 404].includes(value.status)) {clearPrivate(); notice.value = 'Notebook access changed. Refresh to check your current access.'}}
function discardDraft() {editing.value = false; draft.value = null; remote.value = null; error.value = ''}
function mayLeave() {if (busy.value || historyBusy.value) return false; if (dirty.value && !window.confirm('Discard your unsaved notebook changes?')) return false; discardDraft(); return true}
defineExpose({dirty, busy, discardDraft})
function asDraft(entry: NotebookEntry): NotebookDraft {return {title: entry.title, body: entry.body, section: entry.section, folderId: activeFolders.value.some(f => f.id === entry.folderId) ? entry.folderId : null, audience: entry.audience, characterIds: [...entry.characterIds], relevantCharacterIds: [...entry.relevantCharacterIds], relatedIds: [...entry.relatedIds]}}
async function loadIndex(append = false, quiet = false) {
  const run = ++listRun, gen = generation
  if (!quiet) loading.value = true
  const offset = append ? index.value?.nextOffset ?? 0 : 0
  try {
    const result = await api.get<NotebookIndex>(path('', {section: section.value, search: search.value.trim(), folder: folder.value, deleted: String(trash.value), character: relevant.value, offset: String(offset)}))
    if (disposed || gen !== generation || run !== listRun) return
    if (append && index.value) result.entries = [...new Map([...index.value.entries, ...result.entries].map(item => [item.id, item])).values()]
    index.value = result; rememberLabels(result.entries)
    if (relevant.value && !result.characters.some(c => c.id === relevant.value)) relevant.value = ''
    await loadPins(gen)
  } catch (e) {if (gen === generation && run === listRun) failure(e)}
  finally {if (run === listRun) loading.value = false}
}
async function loadPins(gen: number) {
  const run = ++pinRun, currentSection = section.value
  if (!pinned.value.length || trash.value) {pinnedEntries.value = []; return}
  const result = await api.get<NotebookIndex>(path('', {section: currentSection, ids: pinned.value.join(',')}))
  if (gen !== generation || run !== pinRun || currentSection !== section.value || trash.value || disposed) return
  pinnedEntries.value = result.entries; rememberLabels(result.entries)
}
async function openEntry(id: string) {
  if (!mayLeave()) return
  const run = ++openRun, gen = generation; opening.value = true; error.value = ''; historyOpen.value = false; versions.value = []
  try {
    const entry = await api.get<NotebookEntry>(path(`/entries/${id}`))
    if (disposed || gen !== generation || run !== openRun) return
    if (entry.section !== section.value) {section.value = entry.section; folder.value = 'all'; search.value = ''; trash.value = false; void loadIndex()}
    selected.value = entry; remote.value = null; rememberLabels(entry.connections); rememberLabels([entry]); browse.value = false
  } catch (e) {if (gen === generation && run === openRun) failure(e)}
  finally {if (run === openRun) opening.value = false}
}
function startEdit() {if (!selected.value || !canManage.value || selected.value.deletedAt) return; draft.value = asDraft(selected.value); baseline.value = JSON.stringify(draft.value); editing.value = true; remote.value = null; historyOpen.value = false; linkResults.value = []; linkQuery.value = ''}
function newEntry() {
  if (!canManage.value || !mayLeave()) return
  openRun++; opening.value = false
  selected.value = null; historyOpen.value = false; remote.value = null; error.value = ''; trash.value = false
  draft.value = {title: '', body: '', section: section.value, folderId: activeFolder.value && !activeFolder.value.deletedAt ? activeFolder.value.id : null, audience: index.value?.role === 'dm' ? 'dm' : 'room', characterIds: [], relevantCharacterIds: relevant.value ? [relevant.value] : [], relatedIds: []}
  editing.value = true; baseline.value = ''; browse.value = false
}
async function save() {
  if (!draft.value || !canManage.value || busy.value || remote.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    let id = selected.value?.id
    if (id) await api.patch(path(`/entries/${id}`), {expectedRevision: selected.value!.revision, draft: draft.value})
    else id = (await api.post<{id: string}>(path('/entries'), draft.value)).id
    editing.value = false; draft.value = null; busy.value = false
    notice.value = 'Changes saved.'; await openEntry(id); await loadIndex()
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && selected.value) {
      error.value = e.message
      try {remote.value = await api.get<NotebookEntry>(path(`/entries/${selected.value.id}`))} catch (readError) {failure(readError)}
    } else failure(e)
  } finally {busy.value = false}
}
async function entryAction(action: 'delete' | 'recover' | 'restore-version', entry: NotebookEntry | NotebookFolder, revision?: number) {
  if (!canManage.value || busy.value || dirty.value) return
  const message = action === 'delete' ? ('body' in entry ? 'Move this entry to Recently deleted? You can recover it later.' : 'Remove this folder? Its notes will be available under Unfiled, and restoring the folder will regroup them.') : action === 'restore-version' ? 'Restore the text from this version? Your current text remains in History. Sharing stays unchanged.' : ''
  if (message && !window.confirm(message)) return
  busy.value = true; error.value = ''
  try {
    await api.post(path(`/entries/${entry.id}/${action}`), {expectedRevision: entry.revision, ...(revision ? {revision} : {})})
    notice.value = action === 'delete' ? 'Moved to Recently deleted.' : action === 'recover' ? 'Recovered.' : 'Earlier text restored as a new version.'
    busy.value = false
    if ('body' in entry) {await openEntry(entry.id); if (action === 'restore-version') await loadHistory()}
    else if (action === 'delete') folder.value = 'unfiled'
    await loadIndex()
  } catch (e) {failure(e); if (e instanceof ApiError && e.status === 409) {await loadIndex(); if (selected.value) {busy.value = false; await openEntry(selected.value.id)}}}
  finally {busy.value = false}
}
async function saveFolder(rename = false) {
  if (!canManage.value || busy.value || dirty.value) return
  busy.value = true; error.value = ''
  try {
    if (rename && activeFolder.value) await api.patch(path(`/folders/${activeFolder.value.id}`), {title: renameTitle.value, expectedRevision: activeFolder.value.revision})
    else {const result = await api.post<{id: string}>(path('/folders'), {title: folderTitle.value, section: section.value}); folder.value = result.id}
    folderTitle.value = ''; newFolderOpen.value = false; folderTools.value = false; await loadIndex(); notice.value = rename ? 'Folder renamed.' : 'Folder created. Folder names are visible to the room.'
  } catch (e) {failure(e)} finally {busy.value = false}
}
async function loadHistory(append = false) {
  if (!selected.value || busy.value || historyBusy.value) return
  historyBusy.value = true; const gen = generation, id = selected.value.id
  try {
    const result = await api.get<{versions: NotebookVersion[]; nextBefore: number | null}>(path(`/entries/${id}/history`, append && historyBefore.value ? {before: String(historyBefore.value)} : {}))
    if (disposed || generation !== gen || selected.value?.id !== id) return
    versions.value = append ? [...versions.value, ...result.versions] : result.versions; historyBefore.value = result.nextBefore; historyOpen.value = true
  } catch (e) {failure(e)} finally {historyBusy.value = false}
}
function togglePin(entry: NotebookSummary) {
  if (pinned.value.includes(entry.id)) pinned.value = pinned.value.filter(id => id !== entry.id)
  else {if (pinned.value.length >= 12) {notice.value = 'Keep up to 12 entries pinned. Unpin one to make room.'; return} pinned.value.push(entry.id)}
  try {localStorage.setItem(pinKey.value, JSON.stringify(pinned.value))} catch {notice.value = 'Pin preferences are unavailable in this browser.'}
  void loadPins(generation).catch(failure)
}
function chooseFolder(value: string) {if (!mayLeave()) return; folder.value = value; folderTools.value = false; void loadIndex()}
function chooseSection(value: NotebookSection) {if (section.value === value || !mayLeave()) return; openRun++; opening.value = false; section.value = value; folder.value = 'all'; selected.value = null; search.value = ''; trash.value = false; historyOpen.value = false; void loadIndex()}
function toggleTrash() {if (!mayLeave()) return; openRun++; opening.value = false; trash.value = !trash.value; folder.value = 'all'; selected.value = null; historyOpen.value = false; void loadIndex()}
function refresh() {if (!busy.value) {error.value = ''; void loadIndex(); void refreshSelected()}}
async function refreshSelected() {
  if (!selected.value || busy.value || opening.value || historyBusy.value) return
  const id = selected.value.id, gen = generation, revision = selected.value.revision, run = openRun
  try {
    const latest = await api.get<NotebookEntry>(path(`/entries/${id}`))
    if (disposed || generation !== gen || run !== openRun || selected.value?.id !== id || selected.value.revision !== revision || busy.value) return
    if (latest.revision !== selected.value.revision) {if (editing.value) remote.value = latest; else {selected.value = latest; historyOpen.value = false}}
  } catch (e) {if (generation === gen) failure(e)}
}
async function findConnections() {
  const run = ++linkRun, gen = generation; linkBusy.value = true
  try {
    const results = await Promise.all((['journal', 'story-items'] as const).map(value => api.get<NotebookIndex>(path('', {section: value, search: linkQuery.value.trim()}))))
    if (run !== linkRun || gen !== generation || disposed) return
    linkResults.value = results.flatMap(value => value.entries).filter(item => item.id !== selected.value?.id).slice(0, 100); rememberLabels(linkResults.value)
  } catch (e) {if (gen === generation) failure(e)} finally {if (run === linkRun) linkBusy.value = false}
}
function highlight() {const el = textArea.value; if (!el || !draft.value || el.selectionStart === el.selectionEnd) {notice.value = 'Select text in the description, then choose Highlight.'; return} const start = el.selectionStart, end = el.selectionEnd; draft.value.body = draft.value.body.slice(0, start) + '==' + draft.value.body.slice(start, end) + '==' + draft.value.body.slice(end); void nextTick(() => {el.focus(); el.setSelectionRange(start + 2, end + 2)})}
function acceptLatestBase() {if (!remote.value) return; if (remote.value.deletedAt) {notice.value = 'The entry was deleted elsewhere. Copy your draft before discarding it, then recover the entry.'; return} selected.value = remote.value; remote.value = null; notice.value = 'Your draft is kept. Saving will replace the latest text and settings with this draft.'}
watch(search, () => {clearTimeout(searchTimer); searchTimer = setTimeout(() => {void loadIndex()}, 250)})
watch(linkQuery, () => {clearTimeout(linkTimer); linkTimer = setTimeout(() => {void findConnections()}, 250)})
watch(() => [props.roomId, props.previewCharacter] as const, () => {
  generation++; listRun++; openRun++; clearPrivate(); search.value = ''; folder.value = 'all'; trash.value = false; relevant.value = props.initialCharacter ?? ''; error.value = ''; notice.value = ''; browse.value = true; pinned.value = []
  try {const saved: unknown = JSON.parse(localStorage.getItem(pinKey.value) ?? '[]'); if (Array.isArray(saved)) pinned.value = saved.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)).slice(0, 12)} catch { /* Pins are optional. */ }
  void loadIndex()
}, {immediate: true})
watch(() => props.initialCharacter, value => {if (!dirty.value) {relevant.value = value ?? ''; void loadIndex()}})
const beforeUnload = (event: BeforeUnloadEvent) => {if (dirty.value || busy.value) {event.preventDefault(); event.returnValue = ''}}
const visibleRefresh = () => {if (document.visibilityState === 'visible' && !busy.value) {void loadIndex(false, true); void refreshSelected()}}
onMounted(() => {poll = setInterval(visibleRefresh, 15000); window.addEventListener('beforeunload', beforeUnload); window.addEventListener('focus', visibleRefresh)})
onUnmounted(() => {disposed = true; generation++; clearInterval(poll); clearTimeout(searchTimer); clearTimeout(linkTimer); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('focus', visibleRefresh)})
</script>

<template>
  <section class="campaign-notebook" aria-label="Campaign notebook">
    <header class="notebook-toolbar">
      <div class="notebook-actions" aria-label="Notebook sections"><button class="sheet-button" :aria-pressed="section==='journal'" @click="chooseSection('journal')">Journal</button><button class="sheet-button" :aria-pressed="section==='story-items'" @click="chooseSection('story-items')">Story items</button></div>
      <div class="notebook-actions"><button class="sheet-button" :disabled="busy||loading" @click="refresh">Refresh</button><button v-if="canManage" class="sheet-button sheet-button-primary" :disabled="busy||opening" @click="newEntry">{{section==='journal'?'New note':'New story item'}}</button></div>
    </header>
    <p v-if="readOnly" class="sheet-notice">Player preview: notebook entries are read-only here.</p>
    <p v-if="section==='story-items'&&!readOnly" class="sheet-small">Important objects, letters and clues. {{index?.role==='dm'?'You manage these entries; players can read the ones you share.':'Your DM manages these entries.'}}</p>
    <p v-if="error" class="sheet-alert" role="alert">{{error}}</p><p v-if="notice" class="notebook-notice" role="status">{{notice}}</p>
    <button class="sheet-button notebook-browse" :aria-expanded="browse" aria-controls="notebook-library" @click="browse=!browse">{{browse?'Hide library':'Browse library'}}</button>
    <div class="notebook-layout" :data-browse="browse">
      <aside id="notebook-library" class="notebook-index" aria-label="Notebook library">
        <label>Search notes<input v-model="search" type="search" maxlength="120" placeholder="Title or description" /></label>
        <label>Show for<select v-model="relevant" :disabled="busy" @change="loadIndex()"><option value="">Whole library</option><option v-for="character in index?.characters" :key="character.id" :value="character.id">Relevant to {{character.name}}</option></select></label>
        <div v-if="pinnedEntries.length&&!trash" class="notebook-pinned"><h3>Pinned for you</h3><div class="notebook-pin-scroll"><button v-for="entry in pinnedEntries" :key="entry.id" class="notebook-entry sheet-button" :aria-current="selected?.id===entry.id?'true':undefined" @click="openEntry(entry.id)">{{entry.title}}</button></div></div>
        <div class="notebook-folder-heading"><h3>{{trash?'Deleted folders':'Folders'}}</h3><button v-if="canManage&&!trash" class="sheet-button sheet-small-button" :disabled="busy||dirty" :aria-expanded="newFolderOpen" @click="newFolderOpen=!newFolderOpen">New</button></div>
        <form v-if="newFolderOpen&&!trash" class="notebook-folder-form" @submit.prevent="saveFolder()"><label>Folder name<input v-model="folderTitle" required maxlength="120" /></label><p class="sheet-small">Folder names are visible to everyone in the room. Sharing is set on each note.</p><button class="sheet-button" :disabled="busy||!folderTitle.trim()||dirty">Create folder</button></form>
        <div class="notebook-folders"><button class="notebook-folder sheet-button" :aria-pressed="folder==='all'" @click="chooseFolder('all')">{{trash?'All deleted entries':'All entries'}}</button><button v-if="!trash" class="notebook-folder sheet-button" :aria-pressed="folder==='unfiled'" @click="chooseFolder('unfiled')">Unfiled</button><button v-for="item in folderList" :key="item.id" class="notebook-folder sheet-button" :aria-pressed="folder===item.id" @click="chooseFolder(item.id)"><span>{{item.title}}</span><small>{{item.count}}</small></button></div>
        <details v-if="activeFolder&&canManage" class="notebook-folder-tools" :open="folderTools" @toggle="folderTools=($event.target as HTMLDetailsElement).open"><summary>Folder options</summary><template v-if="!activeFolder.deletedAt"><form @submit.prevent="saveFolder(true)"><label>New name<input v-model="renameTitle" :placeholder="activeFolder.title" maxlength="120" required /></label><button class="sheet-button" :disabled="busy||dirty||!renameTitle.trim()">Rename</button></form><button class="sheet-button" :disabled="busy||dirty" @click="entryAction('delete',activeFolder)">Remove folder</button></template><button v-else class="sheet-button" :disabled="busy" @click="entryAction('recover',activeFolder)">Recover folder</button></details>
        <div class="notebook-folder-heading"><h3>{{trash?'Recently deleted':activeFolder?.title??(folder==='unfiled'?'Unfiled':'Entries')}}</h3><small>{{index?.total??0}}</small></div>
        <div class="notebook-entry-scroll" :aria-busy="loading"><button v-for="entry in index?.entries" :key="entry.id" class="notebook-entry sheet-button" :aria-current="selected?.id===entry.id?'true':undefined" @click="openEntry(entry.id)"><strong>{{entry.title}}</strong><small>{{audienceLabel(entry)}}</small></button><p v-if="!index?.entries.length" class="sheet-small notebook-empty">{{loading?'Opening the library…':search?'No matching entries. Try another search.':trash?'No deleted entries.':'No entries here yet.'}}</p><button v-if="index?.nextOffset!==null&&index?.nextOffset!==undefined" class="sheet-button" :disabled="loading" @click="loadIndex(true)">Load more entries</button></div>
        <button class="sheet-button notebook-trash" :aria-pressed="trash" :disabled="busy" @click="toggleTrash">{{trash?'Back to library':'Recently deleted'}}</button>
      </aside>
      <article v-motion-panel="`${section}:${selected?.id}:${editing}`" class="sheet-panel notebook-reader" :aria-busy="opening||busy">
        <p v-if="opening" class="sheet-small" role="status">Opening entry…</p>
        <template v-else-if="editing&&draft">
          <form class="notebook-editor" @submit.prevent="save">
            <div class="notebook-reader-heading"><h2>{{selected?'Edit entry':section==='journal'?'New note':'New story item'}}</h2><span class="sheet-small">{{dirty?'Unsaved changes':'Saved version'}}</span></div>
            <label>Title<input v-model="draft.title" maxlength="120" required :disabled="busy" /></label>
            <label>Folder<select v-model="draft.folderId" :disabled="busy"><option :value="null">Unfiled</option><option v-for="item in activeFolders" :key="item.id" :value="item.id">{{item.title}}</option></select></label>
            <div class="notebook-actions"><span class="sheet-small">Description · Markdown supported</span><button type="button" class="sheet-button sheet-small-button" :disabled="busy" @click="highlight">Highlight selection</button></div>
            <label class="notebook-description-label">Description<textarea ref="textArea" v-model="draft.body" maxlength="60000" rows="12" :disabled="busy" placeholder="Write your notes here. Use **bold**, ==highlight== or [[Connected note]]." /></label>
            <details class="notebook-subpanel"><summary>Reading preview</summary><NotebookText :body="draft.body" :links="selected?.connections??[]" /></details>
            <details v-if="index?.role==='dm'" class="notebook-subpanel" open><summary>Sharing & character relevance</summary><label>Who can read this?<select v-model="draft.audience" :disabled="busy"><option value="dm">DM only</option><option value="room">Whole room</option><option value="characters">Selected characters</option></select></label><fieldset v-if="draft.audience==='characters'"><legend>Share with the players assigned to</legend><label v-for="character in index.characters" :key="character.id" class="notebook-check"><input v-model="draft.characterIds" type="checkbox" :value="character.id" :disabled="busy" />{{character.name}}</label><p v-if="!draft.characterIds.length" class="sheet-small">Choose at least one character before saving.</p></fieldset><fieldset><legend>Relevant to (for filtering only)</legend><label v-for="character in index.characters" :key="character.id" class="notebook-check"><input v-model="draft.relevantCharacterIds" type="checkbox" :value="character.id" :disabled="busy" />{{character.name}}</label></fieldset></details>
            <p v-else class="sheet-small">{{selected?'Sharing is managed by your DM.':'New player notes are shared with the whole room.'}}</p>
            <details class="notebook-subpanel" @toggle="($event.target as HTMLDetailsElement).open&&!linkResults.length&&findConnections()"><summary>Connected entries · {{draft.relatedIds.length}}</summary><div class="notebook-actions"><span v-for="id in draft.relatedIds" :key="id" class="notebook-link-tag">{{labels[id]??'Connected entry'}}<button type="button" class="sheet-button sheet-small-button" :disabled="busy" :aria-label="`Remove connection to ${labels[id]??'entry'}`" @click="draft.relatedIds=draft.relatedIds.filter(value=>value!==id)">×</button></span></div><label>Find an entry<input v-model="linkQuery" type="search" maxlength="120" :disabled="busy" /></label><p v-if="linkBusy" class="sheet-small">Finding entries…</p><div class="notebook-link-results"><label v-for="entry in linkResults" :key="entry.id" class="notebook-check"><input v-model="draft.relatedIds" type="checkbox" :value="entry.id" :disabled="busy" />{{entry.title}}<small>{{entry.section==='journal'?'Journal':'Story item'}}</small></label></div><p class="sheet-small">Connections appear in both entries. Only entries the reader can access are shown.</p></details>
            <section v-if="remote" class="notebook-conflict" role="alert"><h3>This entry changed elsewhere</h3><p>Your draft is kept. Compare it with the latest saved entry before replacing it.</p><details><summary>Latest saved version · {{remote.editedBy}}</summary><h3>{{remote.title}}</h3><p class="sheet-small">{{audienceLabel(remote)}}{{remote.deletedAt?' · Deleted':''}}</p><NotebookText :body="remote.body" /></details><div class="notebook-actions"><button type="button" class="sheet-button" :disabled="!!remote.deletedAt" @click="acceptLatestBase">Keep my draft over this version</button><button type="button" class="sheet-button" @click="discardDraft();refreshSelected()">Discard draft & load latest</button></div></section>
            <footer class="notebook-reader-foot"><span class="sheet-small">Save creates a recoverable version.</span><div class="notebook-actions"><button type="button" class="sheet-button" :disabled="busy" @click="mayLeave()">Cancel</button><button class="sheet-button sheet-button-primary" :disabled="busy||!!remote||!draft.title.trim()||(draft.audience==='characters'&&!draft.characterIds.length)">{{busy?'Saving…':'Save changes'}}</button></div></footer>
          </form>
        </template>
        <template v-else-if="selected">
          <header class="notebook-reader-heading"><div><h2>{{selected.title}}</h2><p class="sheet-small">{{audienceLabel(selected)}} · {{selected.editedBy}} · {{date(selected.updatedAt)}}</p></div><div class="notebook-actions"><button v-if="!selected.deletedAt" class="sheet-button sheet-small-button" :aria-pressed="pinned.includes(selected.id)" @click="togglePin(selected)">{{pinned.includes(selected.id)?'Unpin':'Pin'}}</button><button v-if="canManage&&!selected.deletedAt" class="sheet-button sheet-small-button" @click="startEdit">Edit</button></div></header>
          <p v-if="selected.deletedAt" class="sheet-notice">This entry is in Recently deleted. {{canManage?'Recover it to edit again.':''}}</p>
          <div class="notebook-reader-scroll"><NotebookText :body="selected.body" :links="selected.connections" @open="openEntry" /></div>
          <details v-if="selected.connections.length&&!selected.deletedAt" class="notebook-connections"><summary>Connected entries · {{selected.connections.length}}</summary><div class="notebook-actions"><button v-for="entry in selected.connections" :key="entry.id" class="sheet-button sheet-small-button" @click="openEntry(entry.id)">{{entry.title}}</button></div></details>
          <footer class="notebook-reader-foot"><button class="sheet-button sheet-small-button" :disabled="historyBusy" :aria-expanded="historyOpen" @click="historyOpen?historyOpen=false:loadHistory()">{{historyBusy?'Opening history…':'History & versions'}}</button><button v-if="canManage" class="sheet-button sheet-small-button" :disabled="busy" @click="entryAction(selected.deletedAt?'recover':'delete',selected)">{{selected.deletedAt?'Recover entry':'Delete entry'}}</button></footer>
          <section v-if="historyOpen" class="notebook-history"><h3>Saved versions</h3><p class="sheet-small">Restoring changes the title and description only. Current sharing and connections stay in place.</p><details v-for="version in versions" :key="version.revision" class="notebook-version"><summary>Version {{version.revision}} · {{version.action}}<span>{{version.editedBy}} · {{date(version.savedAt)}}</span></summary><h3>{{version.title}}</h3><div class="notebook-version-scroll"><NotebookText :body="version.body" /></div><button v-if="canManage&&!selected.deletedAt&&version.revision!==selected.revision" class="sheet-button sheet-small-button" :disabled="busy" @click="entryAction('restore-version',selected,version.revision)">Restore this text</button></details><button v-if="historyBefore" class="sheet-button" :disabled="historyBusy" @click="loadHistory(true)">Older versions</button><p v-if="!versions.length" class="sheet-small">No saved versions available to you.</p></section>
        </template>
        <div v-else class="notebook-welcome"><h2>{{section==='journal'?'Campaign journal':'Story items'}}</h2><p class="sheet-prose">{{section==='journal'?'People you meet, places you explore, and clues you want to remember.':'Keep the important objects and discoveries of your campaign within reach.'}}</p><p class="sheet-small">{{canManage?'Choose an entry or create one to begin.':'Choose an entry from the library to read it.'}}</p><button v-if="canManage" class="sheet-button sheet-button-primary" :disabled="busy" @click="newEntry">{{section==='journal'?'Create a note':'Create a story item'}}</button></div>
      </article>
    </div>
  </section>
</template>
