<script setup lang="ts">
import {computed, onUnmounted, ref, watch} from 'vue'
import {api, ApiError} from '../../lib/api'
import {vMotionPanel} from '../../directives/siteMotion'
import NotebookText from '../notebook/NotebookText.vue'
import type {NotebookEntry, NotebookIndex, NotebookSummary} from '../../../shared/notebook'
import {CITY_LIMITS, type CityEntry, type CityLibrary, type CityDraft} from '../../../shared/map-city-library'
import './map-city-library.css'

const props = defineProps<{roomId: string; library: CityLibrary; region: string; note: NotebookEntry | null; noteBusy: boolean; noteError: string; canManage: boolean; expanded: boolean; disabled: boolean}>()
const emit = defineEmits<{close: []; expand: []; read: [id: string]; notebook: []; saved: [city: CityLibrary]; removed: []; reload: []}>()
const category = ref('Overview'), query = ref(''), reading = ref(''), organising = ref(false)
const entries = ref<CityEntry[]>([]), categoryNames = ref<string[]>([]), description = ref('')
const newCategory = ref(''), feedback = ref(''), error = ref(''), saving = ref(false), conflict = ref(false)
const linkQuery = ref(''), linkPicker = ref(false), candidates = ref<NotebookSummary[]>([]), searching = ref(false), searchError = ref('')
const linkCategory = ref(''), rename = ref<Record<string, string>>({}), baseRevision = ref(0), baseline = ref('')
let searchTimer: ReturnType<typeof setTimeout>, searchRun = 0, disposed = false
const draft = computed<CityDraft>(() => ({description: description.value, categories: categoryNames.value,
  entries: entries.value.map(({id, category, relation, description}) => ({id, category, relation, description}))}))
const dirty = computed(() => organising.value && JSON.stringify(draft.value) !== baseline.value)
const busy = computed(() => saving.value), locked = computed(() => saving.value || props.disabled)
function reset(city = props.library) {
  entries.value = city.entries.map(e => ({...e})); categoryNames.value = [...city.categories]
  description.value = city.description; baseRevision.value = city.revision
  baseline.value = JSON.stringify(draft.value); conflict.value = false; error.value = ''; rename.value = {}
  if (!categoryNames.value.includes(category.value)) category.value = 'Overview'
  if (!categoryNames.value.includes(linkCategory.value)) linkCategory.value = categoryNames.value[0] ?? ''
}
watch(() => props.library, (city, old) => {
  if (!old || city.entryId !== old.entryId) {reading.value = ''; organising.value = false; query.value = ''; category.value = 'Overview'}
  if (!dirty.value) reset(city)
}, {immediate: true})
function discardDraft() {reset(); organising.value = false; linkPicker.value = false}
defineExpose({dirty, busy, discardDraft})
const categories = computed(() => categoryNames.value)
const filtered = computed(() => entries.value.filter(e => (!query.value.trim() || `${e.title} ${e.description} ${e.relation}`.toLowerCase().includes(query.value.trim().toLowerCase())) && (category.value === 'Overview' || e.category === category.value)))
const groups = computed(() => (category.value === 'Overview' ? categories.value : [category.value]).map(name => ({name, entries: filtered.value.filter(e => e.category === name)})).filter(g => g.entries.length))
const selected = computed(() => entries.value.find(e => e.id === reading.value))
const available = computed(() => candidates.value.filter(n => n.id !== props.library.entryId && !entries.value.some(e => e.id === n.id)))
const path = (tail = '') => `/api/rooms/${props.roomId}/cities/${props.library.entryId}${tail}`
function read(id: string) {reading.value = id; emit('read', id)}
function chooseCategory(name: string) {category.value = name; reading.value = ''}
function organise() {reset(); organising.value = true; reading.value = ''; feedback.value = ''}
function addCategory() {
  const name = newCategory.value.trim()
  if (!name || name.toLocaleLowerCase()==='overview' || categories.value.some(c => c.toLocaleLowerCase() === name.toLocaleLowerCase()) || categories.value.length >= CITY_LIMITS.categories) return
  categoryNames.value.push(name); newCategory.value = ''; feedback.value = 'Category added to your draft.'
}
function renameCategory(name: string) {
  const value = rename.value[name]?.trim()
  if (!value || value.toLocaleLowerCase()==='overview' || value.length > 30 || categories.value.some(c => c !== name && c.toLocaleLowerCase() === value.toLocaleLowerCase())) {error.value = 'Choose a different category name, up to 30 characters.'; return}
  categoryNames.value = categoryNames.value.map(c => c === name ? value : c)
  entries.value = entries.value.map(e => e.category === name ? {...e, category: value} : e)
  if (linkCategory.value === name) linkCategory.value = value
  delete rename.value[name]; error.value = ''
}
function removeCategory(name: string) {
  if (categoryNames.value.length <= 1 || entries.value.some(e => e.category === name)) return
  categoryNames.value = categoryNames.value.filter(c => c !== name)
  if (linkCategory.value === name) linkCategory.value = categoryNames.value[0] ?? ''
}
function unlink(id: string) {entries.value = entries.value.filter(e => e.id !== id); feedback.value = 'Unlinked in your draft. The notebook note is kept.'}
function link(note: NotebookSummary) {
  if (!linkCategory.value || entries.value.length >= CITY_LIMITS.entries) return
  entries.value.push({id: note.id, title: note.title, category: linkCategory.value, relation: 'Related', description: '', audience: note.audience, unavailable: false})
  feedback.value = `${note.title} linked in your draft.`
}
async function findNotes() {
  if (!linkPicker.value || !props.canManage) return
  const run = ++searchRun; searching.value = true; searchError.value = ''
  try {
    const result = await Promise.all(['journal', 'story-items'].map(section => api.get<NotebookIndex>(`/api/rooms/${props.roomId}/notebook?section=${section}&search=${encodeURIComponent(linkQuery.value)}`)))
    if (!disposed && run === searchRun) candidates.value = result.flatMap(r => r.entries).sort((a, b) => a.title.localeCompare(b.title))
  } catch (e) {if (!disposed && run === searchRun) searchError.value = e instanceof Error ? e.message : 'Entries could not be loaded.'}
  finally {if (!disposed && run === searchRun) searching.value = false}
}
watch([linkQuery, linkPicker], () => {clearTimeout(searchTimer); searchRun++; candidates.value = []; if (linkPicker.value) searchTimer = setTimeout(findNotes, 250)})
async function write(action: 'save' | 'undo' | 'remove') {
  if (locked.value || !props.canManage || conflict.value) return
  if (action === 'remove' && !window.confirm('Remove this city library? Its notes and map pins are kept. Using this note as a city again restores the library.')) return
  if (action === 'undo' && !window.confirm('Undo the last saved city edit? Notebook notes are kept unchanged.')) return
  saving.value = true; error.value = ''
  try {
    if (action === 'save') await api.patch(path(), {expectedRevision: baseRevision.value, draft: draft.value})
    else await api.post(path(`/${action}`), {expectedRevision: props.library.revision})
    if (disposed) return
    if (action === 'remove') {emit('removed'); return}
    const city = await api.get<CityLibrary>(path())
    if (disposed) return
    reset(city); organising.value = false; linkPicker.value = false
    emit('saved', city); feedback.value = action === 'undo' ? 'Last city edit undone.' : 'City library saved.'
  } catch (e) {
    if (disposed) return
    error.value = e instanceof Error ? e.message : 'The city library could not be saved.'
    conflict.value = !(e instanceof ApiError) || e.status !== 400
    if (!(e instanceof ApiError) || ![400, 409].includes(e.status)) error.value += ' Reload before saving again; your draft is kept until then.'
  } finally {saving.value = false}
}
function reload() {if (!dirty.value || window.confirm('Discard this city draft and load the latest library?')) {organising.value = false; conflict.value = false; emit('reload')}}
onUnmounted(() => {disposed = true; searchRun++; clearTimeout(searchTimer)})
</script>
<template>
  <aside class="sheet-panel map-drawer map-city-library" aria-label="City library">
    <header class="map-city-heading">
      <div class="map-city-context"><span class="sheet-small">City<span v-if="region"> · {{region}}</span></span></div>
      <div class="map-city-title"><h3>{{library.title}}</h3><button class="sheet-button sheet-small-button" type="button" :disabled="locked" @click="emit('close')">Close city</button></div>
      <p v-if="library.description" class="sheet-small map-city-description">{{library.description}}</p>
      <div class="map-actions">
        <button class="sheet-button sheet-small-button map-city-expand" type="button" :aria-pressed="expanded" :disabled="locked" @click="emit('expand')">{{expanded?'Compact city':'Expand city'}}</button>
        <button v-if="canManage&&!organising" class="sheet-button sheet-small-button" type="button" :disabled="locked" @click="organise">Organise entries</button>
        <details v-if="canManage&&!organising" class="map-city-tools"><summary>City options</summary><div class="map-actions"><button type="button" class="sheet-button sheet-small-button" :disabled="locked||!library.canUndo" @click="write('undo')">Undo last city edit</button><button type="button" class="sheet-button sheet-small-button" :disabled="locked" @click="write('remove')">Remove city library</button></div></details>
        <button v-if="!organising" type="button" class="sheet-button sheet-small-button" :disabled="locked" @click="read(library.entryId)">City note</button>
      </div>
    </header>
    <nav v-if="!organising" class="map-city-tabs" aria-label="City categories"><button v-for="name in ['Overview',...categories]" :key="name" type="button" :aria-pressed="category===name" :disabled="locked" @click="chooseCategory(name)">{{name}}<span v-if="name!=='Overview'">{{entries.filter(e=>e.category===name).length}}</span></button></nav>
    <div v-if="!organising&&!reading" class="map-city-search"><label>Find in {{library.title}}<input v-model="query" type="search" placeholder="People, places, quests…" maxlength="120" :disabled="locked" /></label></div>
    <div class="map-city-content" :data-reading="!!reading" :data-expanded="expanded" :data-organising="organising">
      <section v-if="organising" class="map-city-organise">
        <label class="map-city-intro">City introduction<textarea v-model="description" maxlength="500" rows="3" :disabled="locked" placeholder="A short introduction for anyone who can read this city note." /></label>
        <h4>Connected notebook entries</h4><p class="sheet-small">Each entry keeps its notebook sharing rules. Save changes to keep these categories and relationships.</p>
        <details class="map-city-link-picker" :open="linkPicker" @toggle="linkPicker=($event.target as HTMLDetailsElement).open"><summary>Link existing entry</summary>
          <label>Find notebook entry<input v-model="linkQuery" type="search" maxlength="120" :disabled="locked" /></label>
          <label>Link into category<select v-model="linkCategory" :disabled="locked"><option v-for="name in categories" :key="name">{{name}}</option></select></label>
          <p v-if="searching" class="sheet-small" role="status">Finding entries…</p><p v-if="searchError" class="sheet-alert" role="alert">{{searchError}}</p>
          <div class="map-city-candidates"><button v-for="candidate in available" :key="candidate.id" type="button" class="sheet-button map-city-entry" :disabled="locked||entries.length>=CITY_LIMITS.entries" @click="link(candidate)"><span><strong>Link {{candidate.title}}</strong><small>{{candidate.section==='journal'?'Journal':'Story item'}} · {{candidate.audience==='dm'?'DM only':candidate.audience==='room'?'Whole room':'Selected characters'}}</small></span></button></div>
          <p v-if="!searching" class="sheet-small">Search to narrow the list. Up to 60 matches from each notebook section are shown.</p>
        </details>
        <details v-for="entry in entries" :key="entry.id" class="map-city-association"><summary><strong>{{entry.title}}{{entry.unavailable?' (unavailable)':''}}</strong><span>{{entry.category}} · {{entry.relation}}<small v-if="entry.audience==='dm'"> · DM only</small></span></summary>
          <div class="map-city-association-fields"><label>Category<select v-model="entry.category" :disabled="locked"><option v-for="name in categories" :key="name">{{name}}</option></select></label><label>Relationship<input v-model="entry.relation" maxlength="60" placeholder="Resident, visits, found here…" :disabled="locked" /></label></div>
          <label class="map-city-entry-hint">Short context<input v-model="entry.description" maxlength="240" :disabled="locked" placeholder="Optional context for this city's list" /></label>
          <button type="button" class="sheet-button sheet-small-button" :disabled="locked" @click="unlink(entry.id)">Unlink from city</button>
        </details>
        <p v-if="!entries.length" class="sheet-small">Link a notebook entry to start this city's library.</p>
        <details class="map-city-customise"><summary>Category settings</summary>
          <div v-for="name in categories" :key="name" class="map-city-category-edit"><label>Category name<input :value="rename[name]??name" maxlength="30" :disabled="locked" @input="rename[name]=($event.target as HTMLInputElement).value" /></label><button type="button" class="sheet-button sheet-small-button" :disabled="locked||!rename[name]?.trim()||rename[name]===name" @click="renameCategory(name)">Rename</button><button type="button" class="sheet-button sheet-small-button" :disabled="locked||categories.length<=1||entries.some(e=>e.category===name)" @click="removeCategory(name)">Remove</button></div>
          <p class="sheet-small">Move or unlink entries before removing their category.</p>
          <form class="map-city-add-category" @submit.prevent="addCategory"><label>New category<input v-model="newCategory" maxlength="30" placeholder="e.g. Factions" :disabled="locked" /></label><button type="submit" class="sheet-button sheet-small-button" :disabled="locked||!newCategory.trim()||categories.length>=CITY_LIMITS.categories">Add category</button></form>
        </details>
      </section>
      <section v-else-if="!reading||expanded" class="map-city-groups" aria-label="Connected entries">
        <div v-for="group in groups" :key="group.name" class="map-city-group"><header><h4>{{group.name}} <span>{{group.entries.length}}</span></h4><button v-if="category==='Overview'" type="button" class="sheet-button sheet-small-button" :disabled="locked" @click="chooseCategory(group.name)">View all</button></header><button v-for="entry in category==='Overview'?group.entries.slice(0,3):group.entries" :key="entry.id" type="button" class="map-city-entry sheet-button" :aria-pressed="reading===entry.id" :disabled="locked||entry.unavailable" @click="read(entry.id)"><span><strong>{{entry.title}}{{entry.unavailable?' (unavailable)':''}}</strong><small>{{entry.description||entry.relation}}</small></span><span v-if="entry.audience!=='room'" class="map-city-audience">{{entry.audience==='dm'?'DM only':'Selected characters'}}</span></button><button v-if="category==='Overview'&&group.entries.length>3" type="button" class="map-city-more sheet-button sheet-small-button" :disabled="locked" @click="chooseCategory(group.name)">{{group.entries.length-3}} more {{group.name.toLowerCase()}}</button></div>
        <p v-if="!groups.length" class="sheet-small">{{query?'No matching entries. Try another name or category.':'No entries linked yet.'}}</p>
      </section>
      <article v-if="reading&&!organising" class="map-city-reader" v-motion-panel="note?.id">
        <button class="sheet-button sheet-small-button" type="button" :disabled="locked" @click="reading=''">Back to {{library.title}}</button><p v-if="noteBusy" class="sheet-small" role="status">Opening entry…</p><p v-if="noteError" class="sheet-alert" role="alert">{{noteError}}</p>
        <template v-if="note&&!noteBusy&&!noteError"><h4>{{note.title}}</h4><p class="sheet-small">{{selected?`${selected.category} · ${selected.relation}`:'City notebook'}}{{note.audience==='dm'?' · DM only':''}}</p><div class="notebook-prose"><NotebookText :body="note.body" :links="note.connections" @open="read" /></div><section v-if="note.connections.length" class="map-city-note-links"><h5>Connected notes</h5><div class="map-actions"><button v-for="link in note.connections" :key="link.id" class="sheet-button sheet-small-button" type="button" :disabled="locked" @click="read(link.id)">{{link.title}}</button></div></section><button class="sheet-button sheet-small-button" type="button" :disabled="locked" @click="emit('notebook')">Open in notebook</button></template>
      </article>
    </div>
    <p v-if="error" class="sheet-alert map-city-error" role="alert">{{error}} <button v-if="conflict" type="button" class="sheet-button sheet-small-button" :disabled="locked" @click="reload">Reload city library</button></p>
    <footer class="map-city-footer sheet-small"><span>{{entries.length}} available entries · Campaign notebook</span><span v-if="feedback" role="status">{{feedback}}</span><div v-if="organising" class="map-actions"><button class="sheet-button sheet-small-button" type="button" :disabled="locked" @click="discardDraft">Cancel</button><button class="sheet-button sheet-small-button sheet-button-primary" type="button" :disabled="locked||!dirty||conflict" @click="write('save')">{{saving?'Saving…':'Save city library'}}</button></div></footer>
  </aside>
</template>
