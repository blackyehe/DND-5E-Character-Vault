<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {api, ApiError} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import {vMotionPanel} from '../../directives/siteMotion'
import {prepareNotebookCover} from '../../lib/notebook-cover'
import type {NotebookDraft, NotebookEntry, NotebookFolder, NotebookFolderDraft, NotebookIndex, NotebookSection, NotebookSummary, NotebookVersion, NotebookEntryType, NotebookQuestStatus} from '../../../shared/notebook'
import {folderDescendants, notebookFolderRows, validFolderParent} from '../../../shared/notebook-folders'
import NotebookText from './NotebookText.vue'
import NotebookGallery from './NotebookGallery.vue'
import NotebookGalleryEditor from './NotebookGalleryEditor.vue'
import './notebook-gallery.css'
import NotebookEditor from './NotebookEditor.vue'
import type {NotebookLinkTarget} from '../../../shared/notebook-links'
import {notebookReading} from '../../../shared/notebook-codex'
import NotebookConnections from './NotebookConnections.vue'
import NotebookFolderFields from './NotebookFolderFields.vue'
import NotebookQuestClues from './NotebookQuestClues.vue'
import NotebookQuestClueEditor from './NotebookQuestClueEditor.vue'
import NotebookTagsEditor from './NotebookTagsEditor.vue'
import NotebookTagFilter from './NotebookTagFilter.vue'
import {mergeNotebookTagChanges, notebookTags, notebookTagKey, NOTEBOOK_TAG_LIMIT} from '../../../shared/notebook-tags'
import './notebook.css'
import './codex.css'
import './notebook-tags.css'

type CodexType = NotebookEntryType
const categories: {id: CodexType; label: string; icon: string}[] = [{id:'people',label:'People',icon:'♙'},{id:'places',label:'Places',icon:'⌂'},{id:'objects',label:'Objects & clues',icon:'◇'},{id:'factions',label:'Groups',icon:'⚑'},{id:'quests',label:'Quests',icon:'⚐'},{id:'events',label:'Events',icon:'◷'},{id:'sessions',label:'Sessions',icon:'☷'}]
const category = ref<CodexType | 'all' | 'pinned'>('people'), dossierTab = ref<'description' | 'encounters' | 'connections' | 'clues' | 'gallery'>('description')
const questFilter = ref<NotebookQuestStatus>('active')
const tagFilter = ref<string[]>([]), tagSaving = ref(false)
const quickTags = ref<string[]|null>(null), quickTagsBase = ref<string[]>([]), quickTagsRevision = ref(0), quickTagsError = ref(''), quickTagsConflict = ref(false)
const quickTagsEditor = ref<InstanceType<typeof NotebookTagsEditor>|null>(null), quickTagsToggle = ref<HTMLButtonElement|null>(null)
const quickTagsDirty = computed(() => quickTags.value!==null && JSON.stringify(quickTags.value.map(notebookTagKey).sort())!==JSON.stringify(quickTagsBase.value.map(notebookTagKey).sort()))
const previewAsCharacter = ref('')
const navigation = ref<{id:string;tab:typeof dossierTab.value;scroll:number}[]>([])
let returning = false
const kindLabel = (kind: CodexType) => categories.find(c=>c.id===kind)?.label ?? 'Entry'
const props = defineProps<{roomId: string; previewCharacter?: string; initialCharacter?: string; initialEntry?: string; localPreview?: boolean}>()
const auth = useAuthStore(), section = ref<NotebookSection>('journal'), index = ref<NotebookIndex | null>(null)
const selected = ref<NotebookEntry | null>(null), editing = ref(false), draft = ref<NotebookDraft | null>(null), baseline = ref('')
const dossierTabs = computed(() => selected.value?.codexType==='quests' ? ['description','clues','encounters','connections'] as const : selected.value?.codexType==='places' ? ['description','gallery','encounters','connections'] as const : ['description','encounters','connections'] as const)
watch(dossierTabs,tabs=>{if(!(tabs as readonly string[]).includes(dossierTab.value))dossierTab.value='description'})
const loading = ref(false), opening = ref(false), busy = ref(false), error = ref(''), notice = ref(''), remote = ref<NotebookEntry | null>(null)
const search = ref(''), folder = ref('all'), relevant = ref(props.initialCharacter ?? ''), trash = ref(false), browse = ref(true)
const emptyFolder = ():NotebookFolderDraft => ({title:'',parentId:null})
const folderDraft = ref<NotebookFolderDraft>(emptyFolder()), folderEdit = ref<NotebookFolderDraft>(emptyFolder()), newFolderOpen = ref(false), folderTools = ref(false)
const folderRevision = ref(0)
const historyOpen = ref(false), versions = ref<NotebookVersion[]>([]), historyBefore = ref<number | null>(null), historyBusy = ref(false)
const linkQuery = ref(''), linkResults = ref<NotebookSummary[]>([]), linkBusy = ref(false)
const bodyEditor = ref<InstanceType<typeof NotebookEditor> | null>(null)
const textArea = computed(() => bodyEditor.value?.textarea ?? null)
const linkTargets = ref<NotebookLinkTarget[]>([]), targetsBusy = ref(false), targetsError = ref('')
const readerLinks = computed(() => [...new Map([...(selected.value?.connections ?? []), ...linkTargets.value].map(item => [item.id,item])).values()])
let targetsLoadedAt = 0, targetsRun = 0, targetsAbort: AbortController | undefined
const pinned = ref<string[]>([]), labels = ref<Record<string, string>>({})
const reader = ref<HTMLElement | null>(null)
const clueEditor = ref<InstanceType<typeof NotebookQuestClueEditor> | null>(null)
const connectionsEditor = ref<HTMLDetailsElement | null>(null)
let editOrigin: {tab:typeof dossierTab.value;scroll:number} | null = null
const coverBusy = ref(false), galleryBusy=ref(false)
const galleryEditor=ref<InstanceType<typeof NotebookGalleryEditor>|null>(null)
let generation = 0, listRun = 0, openRun = 0, linkRun = 0, disposed = false
let poll: ReturnType<typeof setInterval>, searchTimer: ReturnType<typeof setTimeout>, linkTimer: ReturnType<typeof setTimeout>
const dirty = computed(() => quickTagsDirty.value || editing.value && !!draft.value && (!selected.value || JSON.stringify(draft.value) !== baseline.value))
const libraryEntryCount = computed(() => index.value?.entryCount ?? Object.values(index.value?.counts ?? {}).reduce((a,b)=>a+b,0))
const encounterReading = computed(() => selected.value ? notebookReading(selected.value.body, index.value?.sessionEntries ?? []).encounters : '')
const readOnly = computed(() => !!props.previewCharacter || !!previewAsCharacter.value || !!index.value?.readOnly)
const canManage = computed(() => !!index.value && !readOnly.value && (index.value.role === 'dm' || (draft.value?.section??selected.value?.section??section.value) === 'journal' && !['quests','events'].includes(draft.value?.codexType??selected.value?.codexType??'')))
const canCreate = computed(() => !!index.value && !readOnly.value && (index.value.role === 'dm' || !['objects','quests','events'].includes(category.value)))
const availableKinds = computed(() => index.value?.role==='dm'?categories:categories.filter(item=>!['objects','quests','events'].includes(item.id)))
const listMotion = ref(0), readerMotion = ref(0)
const canManageFolders = computed(() => !!index.value && !readOnly.value && index.value.role === 'dm')
const activeFolder = computed(() => index.value?.folders.find(item => item.id === folder.value))
const activeFolders = computed(() => {const folders=index.value?.folders??[], map=new Map(folders.map(f=>[f.id,f])); return folders.filter(f=>validFolderParent(null,f.id,f.section,map))})
const filterCharacters = computed(() => index.value?.characters.filter(character => character.assigned) ?? [])
const folderList = computed(() => index.value?.folders.filter(item => trash.value ? !!item.deletedAt : !item.deletedAt) ?? [])
const folderRows = computed(() => notebookFolderRows(trash.value?folderList.value:activeFolders.value))
const parentOptions = computed(() => notebookFolderRows(activeFolders.value).filter(row=>row.folder.section===section.value).map(row=>({id:row.folder.id,path:row.path})))
const editParentOptions = computed(() => {const options=notebookFolderRows(activeFolders.value).filter(row=>row.folder.section===activeFolder.value?.section).map(row=>({id:row.folder.id,path:row.path}));const excluded=activeFolder.value?folderDescendants(activeFolder.value.id,activeFolders.value):new Set<string>(); return options.filter(f=>!excluded.has(f.id))})
const folderPath = computed(() => notebookFolderRows(index.value?.folders??[]).find(row=>row.folder.id===folder.value)?.path)
const pinKey = computed(() => `codex:notebook-pins:v1:${auth.user?.id ?? 'anonymous'}:${props.roomId}`)
const date = (value: string) => new Date(value).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'})
const audienceLabel = (entry: Pick<NotebookSummary,'audience'>) => entry.audience === 'dm' ? 'DM only' : entry.audience === 'room' ? 'Whole room' : 'Selected characters'
function path(tail = '', query: Record<string, string> = {}) {const values = new URLSearchParams(query); if (props.previewCharacter || previewAsCharacter.value) values.set('previewCharacter', props.previewCharacter || previewAsCharacter.value); return `/api/rooms/${props.roomId}/notebook${tail}${values.size ? '?' + values : ''}`}
function rememberLabels(values: {id: string; title: string}[]) {for (const item of values) labels.value[item.id] = item.title}
function clearPrivate() {resetQuickTags();targetsRun++;targetsAbort?.abort();targetsBusy.value=false;linkTargets.value=[];targetsError.value='';targetsLoadedAt=0;index.value = null; selected.value = null; draft.value = null; editing.value = false; opening.value = false; remote.value = null; versions.value = []; linkResults.value = []; labels.value = {};tagFilter.value=[]}
function failure(value: unknown) {error.value = value instanceof Error ? value.message : 'The notebook could not be updated. Try Refresh.'; if (value instanceof ApiError && [401, 404].includes(value.status)) {clearPrivate(); notice.value = 'Notebook access changed. Refresh to check your current access.'}}
function resetQuickTags(){quickTags.value=null;quickTagsBase.value=[];quickTagsRevision.value=0;quickTagsError.value='';quickTagsConflict.value=false}
function discardDraft() {resetQuickTags();editing.value = false; draft.value = null; remote.value = null; error.value = ''}
function mayLeave() {if (busy.value || historyBusy.value) return false; if (dirty.value && !window.confirm('Discard your unsaved notebook changes?')) return false; discardDraft(); return true}
defineExpose({dirty, busy, discardDraft})
function asDraft(entry: NotebookEntry): NotebookDraft {return {title: entry.title, body: entry.body, coverImage: entry.coverImage ?? '', gallery:(entry.gallery??[]).map(art=>({...art})), section: entry.section, folderId: activeFolders.value.some(f => f.id === entry.folderId) ? entry.folderId : null, audience: entry.audience, characterIds: [...entry.characterIds], relevantCharacterIds: [...entry.relevantCharacterIds], relatedIds: [...entry.relatedIds], codexType:entry.codexType,showInEvents:entry.showInEvents??false,questStatus:entry.questStatus??null,questClues:(entry.questClues??[]).map(clue=>({...clue,sessions:[...clue.sessions]})),tags:[...(entry.tags??[])]}}
async function uploadCover(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0], current = draft.value
  if (!file || !current || busy.value || coverBusy.value) return
  const gen = generation
  coverBusy.value = true; error.value = ''
  try {
    const image = await prepareNotebookCover(file)
    if (!disposed && gen === generation && draft.value === current && current.codexType === 'places') current.coverImage = image
  } catch (e) {
    if (!disposed && gen === generation && draft.value === current) error.value = e instanceof Error ? e.message : 'The image could not be prepared.'
  } finally { coverBusy.value = false; input.value = '' }
}
async function loadIndex(append = false, quiet = false, animate = false) {
  const run = ++listRun, gen = generation
  if (!quiet) loading.value = true
  const offset = append ? index.value?.nextOffset ?? 0 : 0
  try {
    const result = await api.get<NotebookIndex>(path('', {section:'all', type:category.value, ...(category.value==='quests'?{questStatus:questFilter.value}:{}), ...(category.value==='pinned'&&pinned.value.length?{ids:pinned.value.join(',')}:{}),tags:JSON.stringify(tagFilter.value), search: search.value.trim(), deleted: String(trash.value), character: category.value==='quests'?'':relevant.value, offset: String(offset)}))
    if (disposed || gen !== generation || run !== listRun) return
    if (!index.value && category.value==='people' && (result.role==='player'||!result.counts.people)) {category.value='all';await loadIndex(false,quiet,animate);return}
    if (append && index.value) result.entries = [...new Map([...index.value.entries, ...result.entries].map(item => [item.id, item])).values()]
    index.value = result; rememberLabels(result.entries)
    if (!targetsBusy.value && Date.now()-targetsLoadedAt >= 15000) void loadLinkTargets()
    if (relevant.value && !result.characters.some(c => c.id === relevant.value && c.assigned)) relevant.value = ''
    if (animate && gen === generation && run === listRun) listMotion.value++
  } catch (e) {if (gen === generation && run === listRun) failure(e)}
  finally {if (run === listRun) loading.value = false}
}
async function loadLinkTargets() {
  const run=++targetsRun, gen=generation
  targetsAbort?.abort();const controller=new AbortController();targetsAbort=controller;targetsBusy.value=true;targetsError.value=''
  try {
    const result=await api.get<{entries:NotebookLinkTarget[]}>(path('/link-targets'),{signal:controller.signal})
    if(disposed||gen!==generation||run!==targetsRun)return
    linkTargets.value=result.entries;targetsLoadedAt=Date.now();rememberLabels(result.entries)
  } catch(e) {
    if(disposed||gen!==generation||run!==targetsRun||controller.signal.aborted)return
    targetsError.value='Note links could not be checked.'
    if(e instanceof ApiError&&[401,403,404].includes(e.status)){clearPrivate();failure(e)}
  } finally {if(run===targetsRun)targetsBusy.value=false}
}
async function openEntry(id: string, initial = false) {
  if (!mayLeave()) return
  const previous = selected.value && selected.value.id!==id && !returning ? {id:selected.value.id,tab:dossierTab.value,scroll:reader.value?.querySelector('.notebook-reader-scroll')?.scrollTop??0} : null
  const run = ++openRun, gen = generation; opening.value = true; error.value = ''; historyOpen.value = false; versions.value = []
  try {
    const entry = await api.get<NotebookEntry>(path(`/entries/${id}`))
    if (disposed || gen !== generation || run !== openRun) return
    if(previous){navigation.value.push(previous);if(navigation.value.length>40)navigation.value.shift()}
    section.value = entry.section
    selected.value = entry; opening.value=false;readerMotion.value++;dossierTab.value='description'; remote.value = null; rememberLabels(entry.connections); rememberLabels([entry]); browse.value = false
    await nextTick()
    if (run === openRun && gen === generation) {
      reader.value?.scrollTo({top: 0, behavior: 'instant'})
      reader.value?.querySelector<HTMLElement>('.notebook-reader-scroll')?.scrollTo({top: 0, behavior: 'instant'})
      const library = reader.value?.parentElement?.querySelector<HTMLElement>('.notebook-index')
      if (!initial && library && getComputedStyle(library).display === 'none') {
        const heading = reader.value?.querySelector<HTMLElement>('h2')
        if (heading) { heading.tabIndex = -1; heading.focus({preventScroll: true}) }
      }
    }
  } catch (e) {if (gen === generation && run === openRun) failure(e)}
  finally {if (run === openRun) opening.value = false}
}
async function startEdit(target:typeof dossierTab.value=dossierTab.value, clueId?:string, addClue=false) {
  if (!selected.value || !canManage.value || selected.value.deletedAt || busy.value || opening.value) return
  if(quickTags.value!==null&&!mayLeave())return
  editOrigin={tab:target,scroll:reader.value?.querySelector('.notebook-reader-scroll')?.scrollTop??0}
  draft.value=asDraft(selected.value);baseline.value=JSON.stringify(draft.value);editing.value=true;readerMotion.value++;remote.value=null;historyOpen.value=false;linkResults.value=[];linkQuery.value=''
  await nextTick()
  if(target==='gallery'){galleryEditor.value?.focus();return}
  if(target==='clues'){if(addClue)await clueEditor.value?.add();else await clueEditor.value?.focusClue(clueId);return}
  if(target==='connections'&&connectionsEditor.value){connectionsEditor.value.open=true;await nextTick();focusEditor(connectionsEditor.value.querySelector('input'));return}
  const input=textArea.value
  if(input){
    const encounter=target==='encounters'?/^(#{1,6})\s+(?:Session|Forrás)/im.exec(draft.value!.body):null
    if(target==='encounters'&&!encounter){const spacer=draft.value!.body.trim()?'\n\n':'';draft.value!.body+=spacer+'## Session-kapcsolat\n\n';await nextTick()}
    const offset=target==='encounters'?(encounter?.index??draft.value!.body.length):0
    input.setSelectionRange(offset,offset);focusEditor(input)
    input.scrollTop=target==='encounters'?input.scrollHeight*(offset/Math.max(1,input.value.length)):0
  }
}
function focusEditor(element:HTMLElement|null) {if(!element||!reader.value)return;reader.value.scrollTop+=element.getBoundingClientRect().top-reader.value.getBoundingClientRect().top-24;element.focus({preventScroll:true})}
async function restoreReader(origin:typeof editOrigin) {if(!origin||!selected.value)return;dossierTab.value=origin.tab;await nextTick();reader.value?.scrollTo({top:0,behavior:'instant'});reader.value?.querySelector('.notebook-reader-scroll')?.scrollTo({top:origin.scroll,behavior:'instant'})}
async function cancelEdit() {const origin=editOrigin;if(!mayLeave())return;await restoreReader(origin)}
function newEntry() {
  if (!canCreate.value || !mayLeave()) return
  openRun++; opening.value = false
  selected.value = null; historyOpen.value = false; remote.value = null; error.value = ''; trash.value = false
  editOrigin=null
  draft.value = {title: '', body: '', section: section.value, folderId: activeFolder.value && !activeFolder.value.deletedAt ? activeFolder.value.id : null, audience: index.value?.role === 'dm' ? 'dm' : 'room', characterIds: [], relevantCharacterIds: relevant.value ? [relevant.value] : [], relatedIds: [], codexType:category.value==='all'||category.value==='pinned'?'people':category.value}
  draft.value.tags=[];draft.value.gallery=[]
  draft.value.showInEvents=category.value==='events'
  changeKind()
  editing.value = true; readerMotion.value++;baseline.value = ''; browse.value = false
}
async function save() {
  if (!draft.value || !canManage.value || busy.value || coverBusy.value || galleryBusy.value || remote.value) return
  const draftQuestStatus = draft.value.codexType==='quests' ? draft.value.questStatus : null
  busy.value = true; error.value = ''; notice.value = ''
  try {
    let id = selected.value?.id
    if (id) await api.patch(path(`/entries/${id}`), {expectedRevision: selected.value!.revision, draft: draft.value})
    else id = (await api.post<{id: string}>(path('/entries'), draft.value)).id
    editing.value = false; draft.value = null; busy.value = false
    if (category.value==='quests' && draftQuestStatus) questFilter.value=draftQuestStatus
    const origin=editOrigin
    targetsLoadedAt=0
    notice.value = props.localPreview?'Local changes saved.':'Changes saved.'; await openEntry(id); await restoreReader(origin); await loadIndex()
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && selected.value) {
      error.value = e.message
      try {remote.value = await api.get<NotebookEntry>(path(`/entries/${selected.value.id}`))} catch (readError) {failure(readError)}
    } else failure(e)
  } finally {busy.value = false}
}
async function entryAction(action: 'delete' | 'recover' | 'restore-version', entry: NotebookEntry | NotebookFolder, revision?: number) {
  if (!canManage.value || busy.value || dirty.value) return
  const message = action === 'delete' ? ('body' in entry ? 'Move this entry to Recently deleted? You can recover it later.' : 'Remove this folder? No entries will be deleted, and entry visibility will stay unchanged. You can recover the folder later.') : action === 'restore-version' ? 'Restore the text from this version? Your current text remains in History. Sharing stays unchanged.' : ''
  if (message && !window.confirm(message)) return
  busy.value = true; error.value = ''
  try {
    await api.post(path(`/entries/${entry.id}/${action}`), {expectedRevision: entry.revision, ...(revision ? {revision} : {})})
    targetsLoadedAt=0
    notice.value = action === 'delete' ? 'Moved to Recently deleted.' : action === 'recover' ? 'Recovered.' : 'Earlier text restored as a new version.'
    busy.value = false
    if ('body' in entry) {await openEntry(entry.id); if (action === 'restore-version') await loadHistory()}
    else if (action === 'delete') folder.value = 'unfiled'
    await loadIndex()
  } catch (e) {failure(e); if (e instanceof ApiError && e.status === 409) {await loadIndex(); if (selected.value) {busy.value = false; await openEntry(selected.value.id)}}}
  finally {busy.value = false}
}
async function saveFolder(rename = false) {
  if (!canManageFolders.value || busy.value || dirty.value) return
  busy.value = true; error.value = ''
  try {
    if (rename && activeFolder.value) await api.patch(path(`/folders/${activeFolder.value.id}`), {...folderEdit.value, expectedRevision: folderRevision.value})
    else {const result = await api.post<{id: string}>(path('/folders'), {...folderDraft.value, section: section.value}); folder.value = result.id}
    targetsLoadedAt=0
    folderDraft.value = emptyFolder(); newFolderOpen.value = false; folderTools.value = false; await loadIndex(); notice.value = rename ? 'Folder settings saved.' : 'Folder created.'
  } catch (e) {failure(e)} finally {busy.value = false}
}
function startFolder() {if(!activeFolder.value)section.value=category.value==='objects'?'story-items':'journal';newFolderOpen.value=!newFolderOpen.value; folderDraft.value={...emptyFolder(),parentId:activeFolder.value&&!activeFolder.value.deletedAt?activeFolder.value.id:null}}
watch(activeFolder, (value, previous) => {if(value&&(value.id!==previous?.id||!folderTools.value)){folderEdit.value={title:value.title,parentId:value.parentId};folderRevision.value=value.revision}})
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
  if(category.value==='pinned')void loadIndex()
}
function chooseFolder(value: string) {if (!mayLeave()) return; folder.value = value; const chosen=index.value?.folders.find(f=>f.id===value);if(chosen)section.value=chosen.section; folderTools.value = false}
function chooseCategory(value: typeof category.value) {if (!mayLeave()) return; category.value=value; section.value=value==='objects'?'story-items':'journal';trash.value=false; folder.value='all'; browse.value=true; void loadIndex(false,false,true)}
async function goBack() {if (!mayLeave()) return; const previous=navigation.value.pop(); if(!previous)return; returning=true; await openEntry(previous.id);returning=false;dossierTab.value=previous.tab;await nextTick();reader.value?.querySelector('.notebook-reader-scroll')?.scrollTo({top:previous.scroll,behavior:'instant'})}
function changeKind() {
  const current=draft.value
  if(!current)return
  current.section=current.codexType==='objects'?'story-items':'journal';section.value=current.section
  if(current.codexType==='events')current.showInEvents=true
  if(current.codexType!=='places'){current.coverImage='';current.gallery=[]}
  if(current.codexType==='quests'){if(current.audience==='characters')current.audience='dm';current.characterIds=[];current.folderId=null;current.questStatus??='active';current.questClues??=[]}
  else {current.questStatus=null;current.questClues=[];if(!activeFolders.value.some(f=>f.id===current.folderId&&f.section===current.section))current.folderId=null}
}
function chooseQuestStatus(value: NotebookQuestStatus) {if(!mayLeave())return;questFilter.value=value;browse.value=true;void loadIndex(false,false,true)}
function chooseTags(values:string[],all=false) {if(!mayLeave())return;tagFilter.value=notebookTags(values);if(all){category.value='all';trash.value=false;search.value='';relevant.value=''}browse.value=true;void loadIndex(false,false,true)}
async function toggleQuickTags(){
  if(!selected.value||!canManageFolders.value||selected.value.deletedAt||busy.value||opening.value)return
  if(quickTags.value!==null){await closeQuickTags();return}
  quickTags.value=[...(selected.value.tags??[])];quickTagsBase.value=[...quickTags.value];quickTagsRevision.value=selected.value.revision;quickTagsError.value='';quickTagsConflict.value=false
  await nextTick();reader.value?.querySelector('.notebook-reader-scroll')?.scrollTo({top:0,behavior:'instant'});await quickTagsEditor.value?.focus()
}
async function closeQuickTags(){if(!mayLeave())return;await nextTick();quickTagsToggle.value?.focus({preventScroll:true})}
async function saveQuickTags(){
  const entry=selected.value,tags=quickTags.value,gen=generation
  if(!entry||!tags||!canManageFolders.value||entry.deletedAt||busy.value||quickTagsConflict.value||!quickTagsDirty.value||tags.length>NOTEBOOK_TAG_LIMIT)return
  busy.value=true;quickTagsError.value=''
  try{
    const result=await api.patch<{tags:string[];revision:number;updatedAt:string;editedBy:string}>(path(`/entries/${entry.id}/tags`),{expectedRevision:quickTagsRevision.value,tags:[...tags]})
    if(disposed||gen!==generation||selected.value?.id!==entry.id)return
    selected.value={...selected.value,...result};resetQuickTags();notice.value='Tags saved.';await loadIndex(false,true);busy.value=false;await nextTick();quickTagsToggle.value?.focus({preventScroll:true})
  }catch(e){if(gen!==generation||disposed)return;quickTagsError.value=e instanceof Error?e.message:'Tags could not be saved. Try again.';quickTagsConflict.value=e instanceof ApiError&&e.status===409;if(e instanceof ApiError&&[401,403,404].includes(e.status)){if(e.status===403)resetQuickTags();failure(e)}}
  finally{if(gen===generation)busy.value=false}
}
async function reloadQuickTags(){
  const entry=selected.value,desired=quickTags.value,gen=generation
  if(!entry||!desired||busy.value)return
  busy.value=true
  try{
    const latest=await api.get<NotebookEntry>(path(`/entries/${entry.id}`))
    if(disposed||gen!==generation||selected.value?.id!==entry.id)return
    selected.value=latest
    if(latest.deletedAt){quickTagsError.value='This entry was deleted. Close this panel and recover it before tagging.';return}
    quickTags.value=mergeNotebookTagChanges(latest.tags??[],quickTagsBase.value,desired);quickTagsBase.value=[...(latest.tags??[])];quickTagsRevision.value=latest.revision;quickTagsConflict.value=false;quickTagsError.value=''
    notice.value=quickTagsDirty.value?'Latest tags loaded. Your additions and removals are kept; save tags to apply them.':'The latest tags already include your changes.'
  }catch(e){if(gen===generation)failure(e)}finally{if(gen===generation)busy.value=false}
}
async function createTag(name:string):Promise<boolean> {
  if(!canManageFolders.value||tagSaving.value)return false
  const gen=generation
  tagSaving.value=true;error.value=''
  try {
    const result=await api.post<{name:string}>(path('/tags'),{name})
    if(disposed||gen!==generation)return false
    // Keep an unsaved entry draft intact while refreshing tag suggestions.
    await loadIndex(false,true)
    if(disposed||gen!==generation)return false
    notice.value='Tag “'+result.name+'” is available. Add it to an entry when needed.'
    return true
  } catch(e){if(gen===generation)failure(e);return false}
  finally{tagSaving.value=false}
}
async function changeQuestStatus() {
  const entry=selected.value
  if(!entry||entry.codexType!=='quests'||!canManage.value||busy.value||editing.value||entry.deletedAt)return
  const next:NotebookQuestStatus=entry.questStatus==='finished'?'active':'finished',gen=generation,run=openRun
  busy.value=true;error.value='';notice.value=''
  try {
    await api.patch(path(`/entries/${entry.id}`),{expectedRevision:entry.revision,draft:{...asDraft(entry),questStatus:next}})
    const latest=await api.get<NotebookEntry>(path(`/entries/${entry.id}`))
    if(disposed||gen!==generation||run!==openRun)return
    selected.value=latest;historyOpen.value=false
    if(category.value==='quests')questFilter.value=next
    notice.value=next==='finished'?'Quest marked finished.':'Quest returned to Active.'
    await loadIndex(false,false,true)
  } catch(e) {failure(e);if(e instanceof ApiError&&e.status===409){busy.value=false;await refreshSelected()}}
  finally {busy.value=false}
}
async function toggleQuestVisibility() {
  const entry=selected.value
  if(!entry||entry.codexType!=='quests'||index.value?.role!=='dm'||!canManage.value||busy.value||editing.value||entry.deletedAt)return
  const audience=entry.audience==='room'?'dm':'room',gen=generation,run=openRun
  busy.value=true;error.value='';notice.value=''
  try {
    await api.patch(path(`/entries/${entry.id}`),{expectedRevision:entry.revision,draft:{...asDraft(entry),audience,characterIds:[]}})
    const latest=await api.get<NotebookEntry>(path(`/entries/${entry.id}`))
    if(disposed||gen!==generation||run!==openRun)return
    selected.value=latest;historyOpen.value=false
    notice.value=audience==='room'?'Quest shown to players. Only Whole room clues are shared.':'Quest and its clues hidden from players.'
    await loadIndex(false,false,true)
  } catch(e) {failure(e);if(e instanceof ApiError&&e.status===409){busy.value=false;await refreshSelected()}}
  finally {busy.value=false}
}
async function toggleQuestClue(id: string) {
  const entry=selected.value
  if(!entry||entry.codexType!=='quests'||index.value?.role!=='dm'||!canManage.value||busy.value||editing.value||entry.deletedAt)return
  const clue=entry.questClues.find(c=>c.id===id)
  if(!clue)return
  const next=clue.audience==='room'?'dm':'room',gen=generation,run=openRun
  busy.value=true;error.value='';notice.value=''
  try {
    const value=asDraft(entry);value.questClues=value.questClues!.map(c=>c.id===id?{...c,audience:next}:c)
    await api.patch(path(`/entries/${entry.id}`),{expectedRevision:entry.revision,draft:value})
    const latest=await api.get<NotebookEntry>(path(`/entries/${entry.id}`))
    if(disposed||gen!==generation||run!==openRun)return
    selected.value=latest;historyOpen.value=false
    notice.value=next==='room'?'Clue shown to players.':'Clue hidden from players.'
    await loadIndex(false,false,true)
  } catch(e) {failure(e);if(e instanceof ApiError&&e.status===409){busy.value=false;await refreshSelected()}}
  finally {busy.value=false}
}
async function resetLocal() {if(!props.localPreview||!mayLeave()||!window.confirm('Reset every local notebook change to the approved copies?'))return;await api.post(path('/reset'));pinned.value=[];try{localStorage.removeItem(pinKey.value)}catch{/* Preferences are optional. */}navigation.value=[];selected.value=null;category.value='people';folder.value='all';search.value='';trash.value=false;await loadIndex();notice.value='Local preview reset.'}
function switchPlayer(event: Event) {const target=event.target as HTMLSelectElement;if(!mayLeave()){target.value=previewAsCharacter.value;return}previewAsCharacter.value=target.value}
function moveTab(direction: number) {const tabs: readonly typeof dossierTab.value[]=dossierTabs.value;dossierTab.value=tabs[(tabs.indexOf(dossierTab.value)+direction+tabs.length)%tabs.length]!;void nextTick(()=>document.getElementById('codex-tab-'+dossierTab.value)?.focus())}
function toggleTrash() {if (!mayLeave()) return; openRun++; opening.value = false; trash.value = !trash.value; category.value='all';folder.value = 'all'; selected.value = null; historyOpen.value = false; void loadIndex(false,false,true)}
function refresh() {if (!busy.value) {error.value = ''; void loadLinkTargets(); void loadIndex(); void refreshSelected()}}
async function refreshSelected() {
  if (!selected.value || busy.value || opening.value || historyBusy.value) return
  const id = selected.value.id, gen = generation, revision = selected.value.revision, run = openRun
  try {
    const latest = await api.get<NotebookEntry|{unchanged:true;revision:number}>(path(`/entries/${id}`,{knownRevision:String(revision)}))
    if('unchanged' in latest)return
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
function acceptLatestBase() {if (!remote.value) return; if (remote.value.deletedAt) {notice.value = 'The entry was deleted elsewhere. Copy your draft before discarding it, then recover the entry.'; return} selected.value = remote.value; remote.value = null; notice.value = 'Your draft is kept. Saving will replace the latest text, artwork and settings with this draft.'}
watch(search, () => {clearTimeout(searchTimer); searchTimer = setTimeout(() => {void loadIndex()}, 250)})
watch(linkQuery, () => {clearTimeout(linkTimer); linkTimer = setTimeout(() => {void findConnections()}, 250)})
watch(() => [props.roomId, props.previewCharacter, previewAsCharacter.value] as const, () => {
  generation++; listRun++; openRun++; navigation.value=[]; category.value=previewAsCharacter.value||props.previewCharacter?'all':'people'; clearPrivate(); search.value = ''; folder.value = 'all'; trash.value = false; relevant.value = props.initialCharacter ?? ''; error.value = ''; notice.value = ''; browse.value = true; pinned.value = []; folderDraft.value=emptyFolder(); folderEdit.value=emptyFolder(); newFolderOpen.value=false; folderTools.value=false
  try {const saved: unknown = JSON.parse(localStorage.getItem(pinKey.value) ?? '[]'); if (Array.isArray(saved)) pinned.value = saved.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)).slice(0, 12)} catch { /* Pins are optional. */ }
  const gen=generation
  void loadIndex().then(() => {if(disposed||gen!==generation)return;if(props.initialEntry) void openEntry(props.initialEntry);else if(!previewAsCharacter.value&&!props.previewCharacter){const first=index.value?.entries[0];if(first)void openEntry(first.id,true).then(()=>{if((reader.value?.parentElement?.clientWidth??1000)<=540)browse.value=true})}})
}, {immediate: true})
watch(() => props.initialCharacter, value => {if (!dirty.value) {relevant.value = value ?? ''; void loadIndex()}})
const beforeUnload = (event: BeforeUnloadEvent) => {if (dirty.value || busy.value) {event.preventDefault(); event.returnValue = ''}}
const visibleRefresh = () => {if (document.visibilityState === 'visible' && !busy.value) {void loadIndex(false, true); void refreshSelected()}}
onMounted(() => {poll = setInterval(visibleRefresh, 15000); window.addEventListener('beforeunload', beforeUnload); window.addEventListener('focus', visibleRefresh)})
onUnmounted(() => {disposed = true; generation++; targetsAbort?.abort(); clearInterval(poll); clearTimeout(searchTimer); clearTimeout(linkTimer); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('focus', visibleRefresh)})
</script>

<template>
  <section class="campaign-notebook notebook-codex" aria-label="Campaign notebook">
    <div v-if="localPreview" class="codex-local-banner"><span><strong>Local design preview</strong> · Approved campaign copies · Changes reset when the server restarts</span><button v-if="!readOnly" class="sheet-button sheet-small-button" :disabled="busy" @click="resetLocal">Reset local changes</button></div>
    <header class="notebook-toolbar">
      <div class="codex-toolbar-title"><div><p class="codex-eyebrow">CAMPAIGN NOTEBOOK</p><h2 class="codex-title">Campaign Codex</h2></div></div>
      <div class="notebook-actions"><label v-if="!previewCharacter&&(index?.role==='dm'||previewAsCharacter)" class="codex-player-select">View as<select :value="previewAsCharacter" :disabled="busy||opening" @change="switchPlayer"><option value="">Dungeon Master</option><option v-for="character in index?.characters" :key="character.id" :value="character.id">Player · {{character.name}}</option></select></label><button class="sheet-button" :disabled="busy||loading" @click="refresh">Refresh</button><button v-if="canCreate" class="sheet-button sheet-button-primary" :disabled="busy||opening" @click="newEntry">{{category==='quests'?'New quest':'New entry'}}</button></div>
    </header>
    <p v-if="readOnly" class="sheet-notice">Player preview: notebook entries are read-only here.</p>
    <div class="codex-message"><p v-if="error" class="sheet-alert" role="alert">{{error}}</p><p v-else class="notebook-notice" role="status">{{notice}}</p></div>
    <div class="codex-status" role="status">{{readOnly?'Player preview · only accessible entries are included':index?.role==='dm'?'DM workspace · sharing applies to each whole entry':'Campaign library · entries shared with you'}}<span>{{index ? libraryEntryCount : '·'}} entries</span></div>
    <details class="codex-folder-settings"><summary>Folders</summary><p class="sheet-small">Folders organize entries and are shared with the whole room. Entry visibility controls what players can read.</p>
        <div class="notebook-folder-heading"><h3>{{trash?'Deleted folders':'Folders'}}</h3><button v-if="canManageFolders&&!trash" class="sheet-button sheet-small-button" :disabled="busy||dirty" :aria-expanded="newFolderOpen" @click="startFolder">New</button></div>
        <form v-if="newFolderOpen&&!trash" class="notebook-folder-form" @submit.prevent="saveFolder()"><label>Collection<select v-model="section" :disabled="busy" @change="folderDraft.parentId=null"><option value="journal">People, places, groups &amp; sessions</option><option value="story-items">Objects &amp; clues</option></select></label><NotebookFolderFields v-model="folderDraft" :parents="parentOptions" :disabled="busy" /><button class="sheet-button" :disabled="busy||!folderDraft.title.trim()||dirty">Create folder</button></form>
        <div class="notebook-folders"><button class="notebook-folder sheet-button" :aria-pressed="folder==='all'" @click="chooseFolder('all')">No folder selected</button><button v-for="row in folderRows" :key="row.folder.id" class="notebook-folder sheet-button" :style="{'--folder-depth':row.depth}" :title="row.path" :aria-pressed="folder===row.folder.id" @click="chooseFolder(row.folder.id)"><span>{{row.folder.title}}</span><small>{{row.folder.count}}</small></button></div>
        <details v-if="activeFolder&&canManageFolders" class="notebook-folder-tools" :open="folderTools" @toggle="folderTools=($event.target as HTMLDetailsElement).open"><summary>Folder options</summary><p class="sheet-small">{{folderPath}}</p><template v-if="!activeFolder.deletedAt"><form @submit.prevent="saveFolder(true)"><NotebookFolderFields v-model="folderEdit" :parents="editParentOptions" :disabled="busy" /><button class="sheet-button" :disabled="busy||dirty||!folderEdit.title.trim()">Save folder settings</button></form><button class="sheet-button" :disabled="busy||dirty" @click="entryAction('delete',activeFolder)">Remove folder</button></template><button v-else class="sheet-button" :disabled="busy" @click="entryAction('recover',activeFolder)">Recover folder</button></details>
        </details>
    <button class="sheet-button notebook-browse" :disabled="browse&&!selected&&!editing" :aria-expanded="browse" aria-controls="notebook-library" @click="browse=!browse">{{browse?(selected||editing?'Return to entry':'Open reader'):'Browse codex'}}</button>
    <div class="notebook-layout" :data-browse="browse">
      <nav class="codex-types" aria-label="Entry categories"><p class="codex-eyebrow">LIBRARY</p><button class="sheet-button" :aria-pressed="category==='all'&&!trash" @click="chooseCategory('all')"><span aria-hidden="true">☰</span>All entries</button><button v-for="item in categories" :key="item.id" class="sheet-button" :aria-pressed="category===item.id&&!trash" @click="chooseCategory(item.id)"><span aria-hidden="true">{{item.icon}}</span>{{item.label}}<small>{{index?.counts[item.id]??0}}</small></button><div class="codex-rail-divider"/><button class="sheet-button" :aria-pressed="category==='pinned'&&!trash" @click="chooseCategory('pinned')"><span aria-hidden="true">☆</span>Bookmarks</button><button v-if="!readOnly" class="sheet-button" :aria-pressed="trash" :disabled="busy" @click="toggleTrash"><span aria-hidden="true">↶</span>Recently deleted</button><p class="codex-rail-note">Find an entry by name.<br/>Explore places through their connections.</p></nav>
      <aside id="notebook-library" class="notebook-index" aria-label="Notebook library">
        <label>Search codex<input v-model="search" type="search" maxlength="120" placeholder="Title or description" /></label>
        <NotebookTagFilter :model-value="tagFilter" :options="index?.tags??[]" :disabled="busy||tagSaving" :can-create="canManageFolders" :create="createTag" :saving="tagSaving" @update:model-value="values=>chooseTags(values)" />
        <details v-if="category!=='quests'&&filterCharacters.length" class="notebook-character-filter" :open="!!relevant"><summary>Character filter <small v-if="relevant">Active</small></summary><label>Notes relevant to<select v-model="relevant" :disabled="busy" @change="loadIndex()"><option value="">All characters</option><option v-for="character in filterCharacters" :key="character.id" :value="character.id">{{character.name}}</option></select></label><p class="sheet-small">Only notes marked relevant to this character. This does not change sharing.</p></details>


        <div v-if="category==='quests'" class="codex-quest-filter" role="group" aria-label="Quest status"><button v-for="status in (['active','finished'] as const)" :key="status" class="sheet-button" :aria-pressed="questFilter===status" :disabled="busy" @click="chooseQuestStatus(status)">{{status==='active'?'Active':'Finished'}}<small>{{index?.questCounts?.[status]??0}}</small></button></div>
        <div class="notebook-folder-heading"><h3>{{trash?'Recently deleted':category==='all'?'All entries':category==='pinned'?'Bookmarks':kindLabel(category)}}</h3><small>{{index?.total??0}}</small></div>
        <div v-motion-panel="listMotion" class="notebook-entry-scroll" :aria-busy="loading"><button v-for="entry in index?.entries" :key="entry.id" class="notebook-entry sheet-button" :aria-current="selected?.id===entry.id?'true':undefined" @click="openEntry(entry.id)"><strong>{{entry.title}}</strong><span v-if="entry.codexType==='quests'" class="codex-quest-badge" :data-status="entry.questStatus">{{entry.questStatus==='finished'?'Finished':'Active'}}</span><small>{{entry.sessions.length?entry.sessions.map(n=>n+'. session').join(' · '):'Session unconfirmed'}}<span v-if="!readOnly"> · {{audienceLabel(entry)}}</span></small></button><p v-if="!index?.entries.length" class="sheet-small notebook-empty">{{loading?'Opening the library…':tagFilter.length?'No entries match these tags. Clear a tag or choose another category.':search?'No matching entries. Try another search.':trash?'No deleted entries.':category==='quests'?(questFilter==='active'?'No active quests.':'No finished quests yet.'):'No entries here yet.'}}</p><button v-if="index?.nextOffset!==null&&index?.nextOffset!==undefined" class="sheet-button" :disabled="loading" @click="loadIndex(true)">Load more entries</button></div>

      </aside>
      <article ref="reader" v-stable-loading="opening||busy" v-motion-panel="readerMotion" class="sheet-panel notebook-reader" :aria-busy="opening||busy">
        <p v-if="opening" class="sheet-small" role="status">Opening entry…</p>
        <template v-else-if="editing&&draft">
          <form class="notebook-editor" @submit.prevent="save">
            <div class="notebook-reader-heading"><h2>{{selected?'Edit entry':'New entry'}}</h2><span class="sheet-small">{{dirty?'Unsaved changes':'Saved version'}}</span></div>
            <label>Category<select v-model="draft.codexType" :disabled="busy||coverBusy||galleryBusy||selected?.codexType==='quests'" @change="changeKind"><option v-for="item in availableKinds" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
            <div v-if="index?.role==='dm'&&draft.codexType!=='events'"><label class="notebook-check"><input v-model="draft.showInEvents" type="checkbox" :disabled="busy" />Also list in Events</label><p v-if="draft.showInEvents" class="sheet-small">Updates appear in both categories. Quest clues stay together with this entry.</p></div>
            <label>Title<input v-model="draft.title" maxlength="120" required :disabled="busy" /></label>
            <NotebookTagsEditor v-if="index?.role==='dm'&&draft.tags" v-model="draft.tags" :options="index.tags??[]" :disabled="busy" />
            <template v-if="draft.codexType==='quests'"><label>Who can read this quest?<select v-model="draft.audience" :disabled="busy"><option value="dm">DM only</option><option value="room">Whole room</option></select></label><p class="sheet-small">Prepare a quest as DM only, then show it to the whole room when the party receives it. Only the DM can edit quests.</p><label>Status<select v-model="draft.questStatus" :disabled="busy"><option value="active">Active</option><option value="finished">Finished</option></select></label><p class="sheet-small">Finished quests can be completed, failed or abandoned. Record the outcome in the description.</p></template>
            <section v-if="draft.codexType==='places'" class="codex-cover-editor" aria-label="Place header image" :aria-busy="coverBusy">
              <label>Header image<input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy||coverBusy" @change="uploadCover" /></label>
              <p class="sheet-small">JPG, PNG or WebP, up to 10 MB. Images are resized automatically and shared with readers of this entry.</p>
              <p v-if="coverBusy" class="sheet-small" role="status">Preparing image…</p>
              <template v-if="draft.coverImage"><div class="codex-cover-preview"><img :src="draft.coverImage" alt="Place header image preview" /></div><button type="button" class="sheet-button sheet-small-button" :disabled="busy||coverBusy" @click="draft.coverImage=''">Remove image</button></template>
            </section>
            <NotebookGalleryEditor v-if="draft.codexType==='places'&&draft.gallery" ref="galleryEditor" v-model="draft.gallery" :disabled="busy||coverBusy" @busy="galleryBusy=$event" />
            <label v-if="draft.codexType!=='quests'">Folder<select v-model="draft.folderId" :disabled="busy||(!canManageFolders&&!!selected)"><option :value="null">Unfiled</option><option v-for="item in parentOptions" :key="item.id" :value="item.id">{{item.path}}</option></select></label>
            <p v-if="draft.folderId" class="sheet-small">Folder placement does not change who can read this entry.</p>
            <p v-if="draft.codexType==='places'" class="sheet-small">Describe the place and its plot notes here. Link locations, NPCs, groups and clues under Connected entries to show them on its overview.</p>
            <NotebookEditor ref="bodyEditor" v-model="draft.body" :disabled="busy" :targets="linkTargets" :loading="targetsBusy" :link-error="targetsError" :exclude-id="selected?.id" :sessions="index?.sessionEntries??[]" @retry="loadLinkTargets" />
            <NotebookQuestClueEditor v-if="draft.codexType==='quests'&&draft.questClues" ref="clueEditor" v-model="draft.questClues" :disabled="busy" :targets="linkTargets" :loading="targetsBusy" :link-error="targetsError" :exclude-id="selected?.id" @retry="loadLinkTargets" />
            <details v-if="index?.role==='dm'&&draft.codexType!=='quests'" class="notebook-subpanel" open><summary>Sharing & character relevance</summary><label>Who can read this?<select v-model="draft.audience" :disabled="busy"><option value="dm">DM only</option><option value="room">Whole room</option><option value="characters">Selected characters</option></select></label><fieldset v-if="draft.audience==='characters'"><legend>Share with the players assigned to</legend><label v-for="character in index.characters" :key="character.id" class="notebook-check"><input v-model="draft.characterIds" type="checkbox" :value="character.id" :disabled="busy" />{{character.name}}</label><p v-if="!draft.characterIds.length" class="sheet-small">Choose at least one character before saving.</p></fieldset><fieldset><legend>Relevant to (for filtering only)</legend><label v-for="character in index.characters" :key="character.id" class="notebook-check"><input v-model="draft.relevantCharacterIds" type="checkbox" :value="character.id" :disabled="busy" />{{character.name}}</label></fieldset></details>
            <p v-else-if="index?.role!=='dm'" class="sheet-small">{{selected?'Sharing is managed by your DM.':'New player notes are shared with the whole room.'}}</p>
            <details ref="connectionsEditor" class="notebook-subpanel" @toggle="($event.target as HTMLDetailsElement).open&&!linkResults.length&&findConnections()"><summary>Connected entries · {{draft.relatedIds.length}}</summary><div class="notebook-actions"><span v-for="id in draft.relatedIds" :key="id" class="notebook-link-tag">{{labels[id]??'Connected entry'}}<button type="button" class="sheet-button sheet-small-button" :disabled="busy" :aria-label="`Remove connection to ${labels[id]??'entry'}`" @click="draft.relatedIds=draft.relatedIds.filter(value=>value!==id)">×</button></span></div><label>Find an entry<input v-model="linkQuery" type="search" maxlength="120" :disabled="busy" /></label><p v-if="linkBusy" class="sheet-small">Finding entries…</p><div class="notebook-link-results"><label v-for="entry in linkResults" :key="entry.id" class="notebook-check"><input v-model="draft.relatedIds" type="checkbox" :value="entry.id" :disabled="busy" />{{entry.title}}<small>{{entry.section==='journal'?'Journal':'Story item'}}</small></label></div><p class="sheet-small">Connections appear in both entries. Only entries the reader can access are shown.</p></details>
            <section v-if="remote" class="notebook-conflict" role="alert"><h3>This entry changed elsewhere</h3><p>Your draft is kept. Compare it with the latest saved entry before replacing it.</p><details><summary>Latest saved version · {{remote.editedBy}}</summary><h3>{{remote.title}}</h3><p class="sheet-small">{{audienceLabel(remote)}}{{remote.deletedAt?' · Deleted':''}}</p><NotebookText :body="remote.body" /><NotebookGallery v-if="remote.codexType==='places'" :images="remote.gallery??[]" :cover="remote.coverImage" :place="remote.title" :entry-id="remote.id" /></details><div class="notebook-actions"><button type="button" class="sheet-button" :disabled="!!remote.deletedAt" @click="acceptLatestBase">Keep my draft over this version</button><button type="button" class="sheet-button" @click="discardDraft();refreshSelected()">Discard draft & load latest</button></div></section>
            <footer class="notebook-reader-foot"><span class="sheet-small">{{draft.codexType==='quests'?(draft.audience==='dm'?'Saving keeps this quest and its clues hidden from players.':'Saving shares this quest and its Whole room clues with players.'):'Save creates a recoverable text version.'}}</span><div class="notebook-actions"><button type="button" class="sheet-button" :disabled="busy" @click="cancelEdit">Cancel</button><button class="sheet-button sheet-button-primary" :disabled="busy||coverBusy||galleryBusy||!!remote||!draft.title.trim()||(draft.audience==='characters'&&!draft.characterIds.length)">{{busy?'Saving…':'Save changes'}}</button></div></footer>
          </form>
        </template>
        <template v-else-if="selected">
          <div class="codex-entry-header" :class="{'has-cover':selected.codexType==='places'&&selected.coverImage}">
          <img v-if="selected.codexType==='places'&&selected.coverImage" class="codex-place-cover" :src="selected.coverImage" alt="" decoding="async" />
          <div class="codex-dossier-top"><button class="sheet-button sheet-small-button" :disabled="!navigation.length" @click="goBack">← Back</button><span class="codex-eyebrow">{{kindLabel(selected.codexType)}}{{selected.codexType!=='events'&&selected.showInEvents?' · Events':''}}</span></div>
          <header class="notebook-reader-heading"><div><h2>{{selected.title}}</h2><p class="sheet-small">{{audienceLabel(selected)}} · {{selected.editedBy}} · {{date(selected.updatedAt)}}</p></div><div class="notebook-actions"><button v-if="!selected.deletedAt" class="sheet-button sheet-small-button" :aria-pressed="pinned.includes(selected.id)" @click="togglePin(selected)">{{pinned.includes(selected.id)?'Unpin':'Pin'}}</button><button v-if="canManage&&!selected.deletedAt" class="sheet-button sheet-small-button" @click="startEdit()">Edit</button></div></header>
          </div>
          <div v-if="selected.codexType==='quests'" class="codex-quest-status"><span class="codex-quest-badge" :data-status="selected.questStatus">{{selected.questStatus==='finished'?'Finished':'Active'}}</span><span class="sheet-small">{{selected.audience==='dm'?'Hidden from players':'Shared with the whole room'}}</span><button v-if="canManage&&!selected.deletedAt" class="sheet-button sheet-small-button" :disabled="busy||opening" @click="toggleQuestVisibility">{{selected.audience==='room'?'Hide from players':'Show to players'}}</button><button v-if="canManage&&!selected.deletedAt" class="sheet-button sheet-small-button" :disabled="busy||opening" @click="changeQuestStatus">{{selected.questStatus==='finished'?'Return to Active':'Mark finished'}}</button></div>
          <div v-if="selected.tags?.length||canManageFolders&&!selected.deletedAt" class="codex-entry-tags" aria-label="Entry tags"><button v-if="canManageFolders&&!selected.deletedAt" ref="quickTagsToggle" type="button" class="sheet-button sheet-small-button codex-edit-tags" :disabled="busy||opening" :aria-expanded="quickTags!==null" aria-controls="notebook-quick-tags" @click="toggleQuickTags">{{selected.tags?.length?'Edit tags':'Add tags'}}</button><button v-for="tag in selected.tags" :key="tag" class="sheet-button sheet-small-button" :disabled="busy" :aria-label="'Filter entries tagged '+tag" @click="chooseTags([tag],true)">{{tag}}</button></div>
          <p v-if="selected.deletedAt" class="sheet-notice">This entry is in Recently deleted. {{canManage?'Recover it to edit again.':''}}</p>
          <div class="codex-session-strip"><span>Sources</span><button v-for="number in selected.sessions" :key="number" class="sheet-button sheet-small-button" :disabled="!index?.sessionEntries.some(e=>e.sessions.includes(number))" @click="openEntry(index!.sessionEntries.find(e=>e.sessions.includes(number))!.id)">{{number}}. session</button><small v-if="!selected.sessions.length">Session unconfirmed</small></div>
          <div class="codex-tabs" role="tablist" aria-label="Entry sections"><button v-for="tab in dossierTabs" :id="'codex-tab-'+tab" :key="tab" class="sheet-button" role="tab" :aria-selected="dossierTab===tab" :tabindex="dossierTab===tab?0:-1" aria-controls="codex-tabpanel" @click="dossierTab=tab" @keydown.right.prevent="moveTab(1)" @keydown.left.prevent="moveTab(-1)">{{tab==='description'?(selected.codexType==='places'?'Overview':'Description'):tab==='clues'?'Clues':tab==='gallery'?'Gallery':tab==='encounters'?'Encounters':'Connections'}}</button></div>
          <div id="codex-tabpanel" v-motion-panel="dossierTab" class="notebook-reader-scroll" role="tabpanel" :aria-labelledby="'codex-tab-'+dossierTab" tabindex="0">
            <section v-if="quickTags!==null&&canManageFolders&&!selected.deletedAt" id="notebook-quick-tags" class="notebook-quick-tags" aria-label="Edit entry tags" @keydown.esc.stop.prevent="closeQuickTags">
              <div class="quick-tags-toolbar"><h3>Edit tags</h3><div class="notebook-actions"><button type="button" class="sheet-button sheet-small-button" :disabled="busy" @click="closeQuickTags">Cancel tags</button><button type="button" class="sheet-button sheet-button-primary sheet-small-button" :disabled="busy||quickTagsConflict||!quickTagsDirty||quickTags.length>NOTEBOOK_TAG_LIMIT||!!selected.deletedAt" @click="saveQuickTags">{{busy?'Saving...':'Save tags'}}</button></div></div><NotebookTagsEditor ref="quickTagsEditor" v-model="quickTags" :options="index?.tags??[]" :disabled="busy" />
              <p v-if="quickTagsError" class="sheet-alert" role="alert">{{quickTagsError}}</p><button v-if="quickTagsConflict" type="button" class="sheet-button sheet-small-button" :disabled="busy||!!selected.deletedAt" @click="reloadQuickTags">Load latest tags</button>
            </section>
            <div v-if="canManage&&!selected.deletedAt&&dossierTab!=='clues'" class="codex-tab-actions"><button class="sheet-button sheet-small-button" :disabled="busy||opening" @click="startEdit()">{{dossierTab==='gallery'?'Edit gallery':dossierTab==='connections'?'Edit connections':dossierTab==='encounters'?'Edit encounters':selected.codexType==='places'?'Edit overview':'Edit description'}}</button></div>
            <template v-if="dossierTab==='description'">
              <NotebookText :body="selected.reading.description||'No description recorded.'" :links="readerLinks" @open="openEntry" />
              <NotebookConnections v-if="selected.codexType==='places'" :connections="selected.connections" @open="openEntry" />
              <NotebookQuestClues v-if="category==='events'&&selected.codexType==='quests'" :clues="selected.questClues??[]" :links="readerLinks" :dm="canManage" :quest-hidden="selected.audience==='dm'" :disabled="busy||opening||!!selected.deletedAt" @add="startEdit('clues',undefined,true)" @edit="startEdit('clues',$event)" @toggle="toggleQuestClue" @open="openEntry" />
            </template>
            <NotebookGallery v-else-if="dossierTab==='gallery'" :key="selected.id" :images="selected.gallery??[]" :cover="selected.coverImage" :place="selected.title" :entry-id="selected.id" :editable="canManage&&!selected.deletedAt" @edit="startEdit('gallery')" />
            <NotebookText v-else-if="dossierTab==='encounters'" :body="encounterReading||'No session encounter recorded yet.'" :links="readerLinks" :sessions="index?.sessionEntries??[]" @open="openEntry" />
            <NotebookQuestClues v-else-if="dossierTab==='clues'" :clues="selected.questClues??[]" :links="readerLinks" :dm="canManage" :quest-hidden="selected.audience==='dm'" :disabled="busy||opening||!!selected.deletedAt" @add="startEdit('clues',undefined,true)" @edit="startEdit('clues',$event)" @toggle="toggleQuestClue" @open="openEntry" />
            <template v-else><NotebookText v-if="selected.reading.relations" :body="selected.reading.relations" :links="readerLinks" @open="openEntry" /><NotebookConnections :connections="selected.connections" :empty-text="canManage?'No entries linked yet. Choose Edit connections to link an entry.':'No connected entries available.'" @open="openEntry" /></template>
          </div>
          <footer class="notebook-reader-foot"><button class="sheet-button sheet-small-button" :disabled="historyBusy" :aria-expanded="historyOpen" @click="historyOpen?historyOpen=false:loadHistory()">{{historyBusy?'Opening history…':'History & versions'}}</button><button v-if="canManage" class="sheet-button sheet-small-button" :disabled="busy" @click="entryAction(selected.deletedAt?'recover':'delete',selected)">{{selected.deletedAt?'Recover entry':'Delete entry'}}</button></footer>
          <section v-if="historyOpen" class="notebook-history"><h3>Saved versions</h3><p class="sheet-small">Restoring changes the title and description only. Current sharing, quest status and connections stay in place.</p><details v-for="version in versions" :key="version.revision" class="notebook-version"><summary>Version {{version.revision}} · {{version.action}}<span>{{version.editedBy}} · {{date(version.savedAt)}}</span></summary><h3>{{version.title}}</h3><div class="notebook-version-scroll"><NotebookText :body="version.body" /></div><button v-if="canManage&&!selected.deletedAt&&version.revision!==selected.revision" class="sheet-button sheet-small-button" :disabled="busy" @click="entryAction('restore-version',selected,version.revision)">Restore this text</button></details><button v-if="historyBefore" class="sheet-button" :disabled="historyBusy" @click="loadHistory(true)">Older versions</button><p v-if="!versions.length" class="sheet-small">No saved versions available to you.</p></section>
        </template>
        <div v-else class="notebook-welcome"><h2>Campaign Codex</h2><p class="sheet-prose">People, places, discoveries, quests and the sessions that connect them.</p><p class="sheet-small">{{canManage?'Choose an entry or create one to begin.':'Choose an entry from the library to read it.'}}</p><button v-if="canManage" class="sheet-button sheet-button-primary" :disabled="busy" @click="newEntry">Create an entry</button></div>
      </article>
    </div>
  </section>
</template>
