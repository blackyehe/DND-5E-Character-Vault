<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, useId, watch} from 'vue'
import {api, ApiError} from '../../lib/api'
import {createdPin, pinSaveOutcome, samePinValues, type PinSaveAttempt} from '../../lib/map-pin-save'
import {vMotionPanel} from '../../directives/siteMotion'
import {MAP_LIMITS, pinDisplay, type MapDraft, type MapIndex, type MapPin, type MapPinDraft, type MapSummary, type MapRegion, type MapPoint, type RoomMap} from '../../../shared/room-maps'
import type {NotebookEntry, NotebookIndex, NotebookSummary} from '../../../shared/notebook'
import NotebookText from '../notebook/NotebookText.vue'
import MapCanvas from './MapCanvas.vue'
import MapRegionEditor from './MapRegionEditor.vue'
import {regionProblem} from '../../../shared/map-regions'
import PinDisplaySettings from './PinDisplaySettings.vue'
import MapPinGlyph from './MapPinGlyph.vue'
import type {CityLibrary} from '../../../shared/map-city-library'
import {inRegion} from '../../../shared/map-regions'
import {defineAsyncComponent} from 'vue'
const MapCityLibrary = defineAsyncComponent(() => import('./MapCityLibrary.vue'))
import '../notebook/notebook.css'
import './room-maps.css'

const props = defineProps<{roomId: string; previewCharacter?: string; active?: boolean}>()
const emit = defineEmits<{openNotebook: [id: string]}>()
const index = ref<MapIndex | null>(null), selected = ref<RoomMap | null>(null), imageUrl = ref(''), imageFailure = ref(false)
const loading = ref(false), opening = ref(false), busy = ref(false), error = ref(''), notice = ref(''), browse = ref(true), search = ref('')
const deletingMap = ref('')
const regionDraft=ref<MapRegion[]>([]), activeRegion=ref(''), regionPoint=ref(-1), regionDrawing=ref(false)
const mapSearch = ref<HTMLInputElement | null>(null)
const mode = ref<'read'|'upload'|'settings'|'pin'|'regions'>('read'), draft = ref<MapDraft | null>(null), baseline = ref('')
const uploadImage = ref(''), uploadName = ref(''), uploadPreview = ref(''), uploadDetails = ref(''), optimizing = ref(false)
const selectedPin = ref(''), editingPin = ref(''), pinDraft = ref<MapPinDraft | null>(null), locating = ref(false)
const pinPanelCollapsed = ref(false), focusMap = ref(false), focusToggle = ref<HTMLButtonElement|null>(null)
const currentCity = ref<CityLibrary|null>(null), cityExpanded = ref(false)
const cityPanel = ref<InstanceType<typeof MapCityLibrary>|null>(null)
const note = ref<NotebookEntry | null>(null), noteBusy = ref(false), noteError = ref(''), drawer = ref(false)
const noteQuery = ref(''), noteResults = ref<NotebookSummary[]>([]), searchBusy = ref(false)
const popup = ref<HTMLDialogElement|null>(null), popupOpen = ref(false), canvas = ref<InstanceType<typeof MapCanvas>|null>(null), noteTray = ref(true)
const interacting = ref(false), blocked = ref(false), menu = ref<{id:string;x:number;y:number}|null>(null), menuPanel = ref<HTMLElement|null>(null)
const pendingPinSave = ref<PinSaveAttempt|null>(null)
const pinUndo = ref<{mapId:string;revision:number;kind:'restore'|'remove'|'recreate';pin:MapPin}|null>(null)
const noteDrag = ref<{entry:NotebookSummary;x:number;y:number;moved:boolean}|null>(null), popupTitle = useId()
let dragSource: HTMLElement|null = null, dragStart: {x:number;y:number;pointer:number}|null = null, returnFocus:HTMLElement|null=null, previousOverflow:string|undefined
let disposed = false, indexRun = 0, openRun = 0, noteRun = 0, searchRun = 0, cityRun = 0
let controller: AbortController | undefined, poll: ReturnType<typeof setInterval>, searchTimer: ReturnType<typeof setTimeout>
const dirty = computed(() => !!cityPanel.value?.dirty || mode.value !== 'read' && (mode.value === 'regions' ? JSON.stringify(regionDraft.value)!==baseline.value : mode.value === 'pin' ? JSON.stringify(pinDraft.value) !== baseline.value : JSON.stringify(draft.value) !== baseline.value || mode.value === 'upload' && !!uploadImage.value))
const saving = computed(() => busy.value || optimizing.value)
const navigationBusy = computed(() => saving.value || interacting.value || !!cityPanel.value?.busy)
defineExpose({dirty, busy: navigationBusy, discardDraft})
const canManage = computed(() => index.value?.role === 'dm' && !index.value.readOnly && !props.previewCharacter)
const assignedCharacters = computed(() => index.value?.characters.filter(c => c.assigned) ?? [])
const pinCharacters = computed(() => index.value?.characters.filter(c => c.assigned || pinDraft.value?.characterIds?.includes(c.id)) ?? [])
const invalidPinSharing = computed(() => pinDraft.value?.audience === 'characters' && !pinDraft.value.characterIds?.length)
const maps = computed(() => index.value?.maps.filter(m => m.title.toLowerCase().includes(search.value.toLowerCase())) ?? [])
const currentPin = computed(() => selected.value?.pins.find(p => p.id === selectedPin.value))
const cityRegion = computed(() => currentPin.value ? selected.value?.regions?.find(r => inRegion(currentPin.value!, r))?.name ?? '' : '')
const showingCity = computed(() => !!currentCity.value && drawer.value && mode.value === 'read')
const audience = (a: string) => a === 'room' ? 'Whole room' : a === 'dm' ? 'DM only' : 'Selected characters'
const mib = (b: number) => (b / 1024 / 1024).toFixed(1)
function path(tail = '', notebook = false, query: Record<string,string> = {}) {
  const values = new URLSearchParams(query); if (props.previewCharacter) values.set('previewCharacter', props.previewCharacter)
  return `/api/rooms/${props.roomId}/${notebook ? 'notebook' : 'maps'}${tail}${values.size ? '?' + values : ''}`
}
function releaseImage() {controller?.abort(); controller = undefined; if (imageUrl.value) URL.revokeObjectURL(imageUrl.value); imageUrl.value = ''}
function clearSelected() {cityRun++;currentCity.value=null;cityExpanded.value=false;focusMap.value=false;activeRegion.value='';openRun++; noteRun++; releaseImage(); popupOpen.value=false;menu.value=null;pinUndo.value=null;pendingPinSave.value=null;blocked.value=false;selected.value = null; note.value = null; selectedPin.value = ''; drawer.value = false; opening.value = false; noteBusy.value = false; imageFailure.value = false; discardDraft()}
function failure(e: unknown) {if (e instanceof ApiError && [401,403,404].includes(e.status)) {clearSelected(); index.value = null} error.value = e instanceof Error ? e.message : 'Maps could not be loaded. Try Refresh.'}
function discardDraft() {cityPanel.value?.discardDraft();regionDraft.value=[];regionPoint.value=-1;regionDrawing.value=false;mode.value = 'read'; draft.value = null; pinDraft.value = null; locating.value = false; editingPin.value = ''; uploadImage.value = ''; uploadPreview.value = ''; uploadName.value = ''; uploadDetails.value = ''; error.value = ''}
function mayLeave() {if (navigationBusy.value) return false; if (dirty.value && !window.confirm('Discard your unsaved map changes?')) return false; discardDraft(); return true}
async function loadIndex() {
  const run = ++indexRun; loading.value = true
  try {
    const result = await api.get<MapIndex>(path())
    if (disposed || run !== indexRun) return
    index.value = result
    if (selected.value && !result.maps.some(m => m.id === selected.value!.id)) clearSelected()
  } catch (e) {if (!disposed && run === indexRun) failure(e)} finally {if (run === indexRun) loading.value = false}
}
async function openMap(id: string) {
  if (!mayLeave()) return
  clearSelected(); const run = ++openRun; opening.value = true; error.value = ''; browse.value = false
  const abort = new AbortController(); controller = abort
  try {
    const image = fetch(path(`/${id}/image`), {credentials: 'include', cache: 'no-cache', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)])}).then(async response=>{
      if (!response.ok) throw new ApiError(response.status, 'The map image is unavailable. Refresh to check access.')
      return response.blob()
    })
    // Fetch metadata and the authorized image together rather than adding their
    // network delays. Browser revalidation reuses unchanged image bytes.
    const [map,blob] = await Promise.all([api.get<RoomMap>(path(`/${id}`), {signal: abort.signal}),image])
    if (disposed || run !== openRun) return
    selected.value = map;popupOpen.value=true
    imageUrl.value = URL.createObjectURL(blob)
  } catch (e) {abort.abort();if (!disposed && run === openRun) {imageFailure.value = true; failure(e)}} finally {if (run === openRun) opening.value = false}
}
async function refresh() {
  if (disposed || props.active === false || navigationBusy.value || loading.value || opening.value || document.visibilityState !== 'visible') return
  await loadIndex()
  if (!selected.value || dirty.value || mode.value !== 'read' || navigationBusy.value || blocked.value) return
  const id = selected.value.id, run = openRun, revision=selected.value.revision
  try {
    const map = await api.get<RoomMap>(path(`/${id}`))
    if (disposed || run !== openRun || dirty.value || mode.value !== 'read' || navigationBusy.value || selected.value?.revision!==revision) return
    if(pinUndo.value&&pinUndo.value.revision!==map.revision)pinUndo.value=null
    selected.value = map
    if (selectedPin.value && !map.pins.some(p => p.id === selectedPin.value)) {noteRun++; note.value = null; drawer.value = false; selectedPin.value = ''}
    else if (drawer.value) {
      if (currentPin.value?.cityLibrary) await loadCity(currentPin.value.entryId, true)
      else if (currentCity.value) {currentCity.value=null;if(currentPin.value?.noteTitle)await loadNote(currentPin.value.entryId)}
      if (note.value) await loadNote(note.value.id, true)
    }
  } catch (e) {if (!disposed && run === openRun) failure(e)}
}
async function loadNote(id: string, quiet = false) {
  const run = ++noteRun; if (!quiet) {noteBusy.value = true; note.value = null} noteError.value = ''; drawer.value = true
  try {
    const result = await api.get<NotebookEntry>(path(`/entries/${id}`, true))
    if (disposed || run !== noteRun) return
    if (result.deletedAt) {note.value = null; noteError.value = 'This entry is no longer available.'; return}
    if (!quiet || note.value?.revision !== result.revision || JSON.stringify(note.value.connections) !== JSON.stringify(result.connections)) note.value = result
  } catch (e) {if (!disposed && run === noteRun) {note.value = null; noteError.value = e instanceof Error ? e.message : 'This entry is unavailable.'; if (e instanceof ApiError && [401,403,404].includes(e.status)) void loadIndex()}}
  finally {if (run === noteRun) noteBusy.value = false}
}
function cityPath(id: string) {
  return `/api/rooms/${props.roomId}/cities/${id}${props.previewCharacter ? '?previewCharacter='+encodeURIComponent(props.previewCharacter) : ''}`
}
async function loadCity(id: string, quiet = false) {
  const run = ++cityRun, mapRun = openRun
  if (!quiet) {currentCity.value=null;noteBusy.value=true;note.value=null;noteError.value=''}
  try {
    const city = await api.get<CityLibrary>(cityPath(id))
    if (disposed || run!==cityRun || mapRun!==openRun || currentPin.value?.entryId!==id || dirty.value) return
    if (JSON.stringify(city)!==JSON.stringify(currentCity.value)) currentCity.value=city
  } catch (e) {
    if (disposed || run!==cityRun || mapRun!==openRun) return
    currentCity.value=null
    if (e instanceof ApiError && e.status===404) {
      if(selected.value)selected.value={...selected.value,pins:selected.value.pins.map(p=>p.entryId===id?{...p,cityLibrary:false}:p)}
      await loadNote(id)
    } else {note.value=null;noteError.value=e instanceof Error?e.message:'City library could not be loaded. Reopen the pin to try again.'}
  } finally {if(run===cityRun&&!quiet)noteBusy.value=false}
}
function closeCity() {if(mayLeave())closeNote()}
function citySaved(city: CityLibrary) {currentCity.value=city}
function cityRemoved() {
  const id=currentCity.value?.entryId
  currentCity.value=null;cityExpanded.value=false
  if(selected.value&&id){selected.value={...selected.value,pins:selected.value.pins.map(p=>p.entryId===id?{...p,cityLibrary:false}:p)};void loadNote(id)}
}
async function createCity() {
  const pin=currentPin.value
  if(!pin||!canManage.value||!mayLeave())return
  const mapRun=openRun;busy.value=true;noteError.value=''
  try {
    await api.post(cityPath(pin.entryId),{})
    if(disposed||openRun!==mapRun)return
    if(selected.value)selected.value={...selected.value,pins:selected.value.pins.map(p=>p.entryId===pin.entryId?{...p,cityLibrary:true}:p)}
    noteTray.value=false
    await loadCity(pin.entryId)
  } catch(e) {if(!disposed&&openRun===mapRun)noteError.value=e instanceof Error?e.message:'City library could not be created. Refresh before retrying.'}
  finally {busy.value=false}
}
function closeNote() {cityRun++;currentCity.value=null;cityExpanded.value=false;noteRun++; note.value = null; drawer.value = false; noteBusy.value = false; selectedPin.value = ''}
function openPin(id: string, reveal = false) {
  if (!mayLeave()) return
  cityRun++; currentCity.value = null; cityExpanded.value = false
  focusMap.value = false
  if (reveal) canvas.value?.centerPin(id)
  selectedPin.value = id
  const pin = selected.value?.pins.find(p => p.id === id)
  if (pin?.cityLibrary){noteTray.value=false;drawer.value=true;noteRun++;note.value=null;void loadCity(pin.entryId)}
  else if (pin?.noteTitle) void loadNote(pin.entryId)
  else {drawer.value = true; note.value = null; noteError.value = 'The linked notebook entry was deleted. Relink this pin or remove it.'}
}
function settings() {if (!selected.value || !canManage.value || !mayLeave()) return; focusMap.value = false; draft.value = {title: selected.value.title, audience: selected.value.audience, characterIds: [...selected.value.characterIds]}; baseline.value = JSON.stringify(draft.value); mode.value = 'settings'}
function upload() {if (!canManage.value || !mayLeave()) return; draft.value = {title: '', audience: 'dm', characterIds: []}; baseline.value = JSON.stringify(draft.value); mode.value = 'upload'; browse.value = false}
async function editRegions(){
  if(!selected.value||!canManage.value||!mayLeave())return
  focusMap.value=false;closeNote();menu.value=null
  regionDraft.value=JSON.parse(JSON.stringify(selected.value.regions??[]))
  baseline.value=JSON.stringify(regionDraft.value);mode.value='regions';regionPoint.value=-1
  if(!regionDraft.value.some(r=>r.id===activeRegion.value))activeRegion.value=regionDraft.value[0]?.id??''
  await nextTick();canvas.value?.measure();if(activeRegion.value)canvas.value?.centerRegion(activeRegion.value)
}
async function finishRegion(){regionDrawing.value=false;await nextTick();canvas.value?.measure();canvas.value?.centerRegion(activeRegion.value)}
function drawRegion(){
  if(saving.value||regionDrawing.value||regionDraft.value.length>=MAP_LIMITS.regionsPerMap)return
  const region:MapRegion={id:crypto.randomUUID(),name:'New region',color:'#91bde1',opacity:.22,fadeZoom:1.8,points:[]}
  regionDraft.value.push(region);activeRegion.value=region.id;regionPoint.value=-1;regionDrawing.value=true
}
const draftRegion=computed(()=>regionDraft.value.find(r=>r.id===activeRegion.value))
function addRegionPoint(point:MapPoint){if(regionDrawing.value&&draftRegion.value&&draftRegion.value.points.length<MAP_LIMITS.pointsPerRegion)draftRegion.value.points.push(point)}
function moveRegionPoint(index:number,point:MapPoint){if(!saving.value&&draftRegion.value?.points[index])draftRegion.value.points[index]=point;regionPoint.value=index}
function insertRegionPoint(index:number,point:MapPoint){if(!saving.value&&draftRegion.value&&draftRegion.value.points.length<MAP_LIMITS.pointsPerRegion){draftRegion.value.points.splice(index+1,0,point);regionPoint.value=index+1}}
function removeRegionPoint(){if(!saving.value&&draftRegion.value&&regionPoint.value>=0&&draftRegion.value.points.length>3){draftRegion.value.points.splice(regionPoint.value,1);regionPoint.value=-1}}
function deleteRegion(){if(!draftRegion.value||saving.value||!window.confirm(`Delete region “${draftRegion.value.name}”? Its pins and notes are kept. Save borders to apply.`))return;regionDraft.value=regionDraft.value.filter(r=>r.id!==activeRegion.value);regionDrawing.value=false;activeRegion.value=regionDraft.value[0]?.id??'';regionPoint.value=-1}
function selectRegion(id:string){if(regionDrawing.value)return;activeRegion.value=id;regionPoint.value=-1}
async function saveRegions(){
  if(!selected.value||!canManage.value||saving.value||interacting.value||blocked.value||regionDrawing.value)return
  if(regionDraft.value.some(r=>!r.name.trim()||regionProblem(r.points))){error.value='Finish each region with a name and a valid border before saving.';return}
  const before=selected.value,run=openRun;busy.value=true;error.value=''
  try{
    await api.patch(path(`/${before.id}/regions`),{expectedRevision:before.revision,regions:regionDraft.value})
    const map=await api.get<RoomMap>(path(`/${before.id}`))
    if(disposed||run!==openRun)return
    selected.value=map;pinUndo.value=null;discardDraft();notice.value='Region borders saved. Pins and notebook entries were kept.'
  }catch(e){if(!disposed&&run===openRun){blocked.value=true;failure(e);if(selected.value)error.value+=' Reload the map before trying again; the save could not be confirmed.'}}finally{busy.value=false}
}
function readMapImage(file: Blob) {
  return new Promise<string>((resolve,reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('This image could not be read. Select the file again.'))
    reader.readAsDataURL(file)
  })
}
async function chooseImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return
  uploadImage.value = ''; uploadPreview.value = ''; uploadDetails.value = ''; optimizing.value = true; error.value = ''
  let bitmap: ImageBitmap | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP file under 20 MiB.')
    const header = new Uint8Array(await file.slice(0,12).arrayBuffer())
    const webp = String.fromCharCode(...header.slice(0,4)) === 'RIFF' && String.fromCharCode(...header.slice(8,12)) === 'WEBP'
    const png = [137,80,78,71,13,10,26,10].every((byte,i) => header[i] === byte)
    const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255
    if (!webp && !png && !jpeg) throw new Error('Choose a still PNG, JPEG or WebP image. Renaming a file does not convert its format.')
    bitmap = await createImageBitmap(file)
    if (bitmap.width * bitmap.height > MAP_LIMITS.inputPixels) throw new Error('Choose a map under 16 megapixels. You can resize a larger map before uploading.')
    // An already compact WebP can grow substantially when canvas re-encodes it.
    // Keep its original bytes; the server still validates the full image.
    if (webp && file.size <= MAP_LIMITS.imageBytes && Math.max(bitmap.width,bitmap.height) <= MAP_LIMITS.dimension) {
      const encoded = await readMapImage(file)
      uploadImage.value = encoded; uploadPreview.value = `data:image/webp;base64,${encoded}`; uploadName.value = file.name
      uploadDetails.value = `${bitmap.width} × ${bitmap.height} pixels · ${(file.size / 1024 / 1024).toFixed(2)} MiB`
      if (draft.value && !draft.value.title) draft.value.title = file.name.replace(/\.[^.]+$/, '').slice(0,120)
      return
    }
    const ratio = Math.min(1, MAP_LIMITS.dimension / Math.max(bitmap.width, bitmap.height))
    canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio)
    const context = canvas.getContext('2d'); if (!context) throw new Error('Your browser could not prepare this image.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const prepared = await new Promise<Blob>((resolve,reject) => canvas!.toBlob(blob => {
      if (blob?.type === 'image/webp') resolve(blob)
      else reject(new Error('Your browser could not prepare a WebP image. Choose an already prepared WebP file.'))
    }, 'image/webp', .85))
    if (prepared.size > MAP_LIMITS.imageBytes) throw new Error('This map is still over 3 MiB at high quality. Choose a more compressed image or resize it.')
    const body = await readMapImage(prepared)
    if (!body) throw new Error('This image could not be read. Select the file again.')
    uploadImage.value = body; uploadPreview.value = `data:image/webp;base64,${body}`; uploadName.value = file.name
    uploadDetails.value = `${canvas.width} × ${canvas.height} pixels · ${(prepared.size / 1024 / 1024).toFixed(2)} MiB · High quality`
    if (draft.value && !draft.value.title) draft.value.title = file.name.replace(/\.[^.]+$/, '').slice(0,120)
  } catch (e) {error.value = e instanceof Error ? e.message : 'This image could not be read.'} finally {bitmap?.close(); if (canvas) {canvas.width = 0; canvas.height = 0} optimizing.value = false}
}
async function saveMap() {
  if (!draft.value || !canManage.value || saving.value) return
  busy.value = true; error.value = ''
  try {
    let id = selected.value?.id
    if (mode.value === 'upload') {if (!uploadImage.value) throw new Error('Choose a map image first.'); id = (await api.post<{id: string}>(path(), {...draft.value, image: uploadImage.value})).id}
    else if (id) await api.patch(path(`/${id}`), {expectedRevision: selected.value!.revision, draft: draft.value})
    discardDraft(); notice.value = 'Map saved.'; busy.value = false
    await loadIndex(); if (id) await openMap(id)
  } catch (e) {failure(e)} finally {busy.value = false}
}
function editPin(existing = false) {
  if (!selected.value || !canManage.value || !mayLeave()) return
  focusMap.value=false
  const pin = existing ? currentPin.value : undefined
  editingPin.value = pin?.id ?? ''; pinDraft.value = pin ? {...pinValues(pin)} : {label: '', entryId: '', x: .5, y: .5, display: pinDisplay(), audience: 'room', characterIds: []}
  baseline.value = pin ? JSON.stringify(pinDraft.value) : ''; mode.value = 'pin'; locating.value = !pin; noteQuery.value = ''; void findNotes()
  pinPanelCollapsed.value = false
}
async function findNotes() {
  const run = ++searchRun; searchBusy.value = true
  try {
    const results = await Promise.all(['journal','story-items'].map(section => api.get<NotebookIndex>(path('', true, {section, search: noteQuery.value.trim()}))))
    if (disposed || run !== searchRun || !canManage.value) return
    noteResults.value = results.flatMap(r => r.entries).slice(0,80)
  } catch (e) {if (!disposed && run === searchRun) failure(e)} finally {if (run === searchRun) searchBusy.value = false}
}
watch(noteQuery, () => {clearTimeout(searchTimer); if(canManage.value&&popupOpen.value)searchTimer = setTimeout(findNotes, 250)})
function chooseNote(entry: NotebookSummary) {if (!pinDraft.value) return; pinDraft.value.entryId = entry.id; if (!pinDraft.value.label) pinDraft.value.label = entry.title}
function place(position: {x: number; y: number}) {if (!pinDraft.value || !locating.value) return; pinDraft.value = {...pinDraft.value, ...position}; locating.value = false}
function moveDraft(position: {x: number; y: number}) {if (mode.value === 'pin' && pinDraft.value && !saving.value && !blocked.value) {pinDraft.value = {...pinDraft.value, ...position}; locating.value = false}}
function chooseLocation() {locating.value = !locating.value; if (locating.value) pinPanelCollapsed.value = true}
function coordinate(axis: 'x'|'y', event: Event) {if (pinDraft.value) pinDraft.value[axis] = Math.max(0,Math.min(1,Number((event.target as HTMLInputElement).value) / 100))}
const pinValues=(pin:MapPinDraft):MapPinDraft=>({label:pin.label,entryId:pin.entryId,x:pin.x,y:pin.y,display:pinDisplay(pin),audience:pin.audience??'room',characterIds:[...(pin.characterIds??[])]})
function finishPinSave(attempt:PinSaveAttempt,map:RoomMap) {
  const {kind,before,id,remember}=attempt,previous=before.pins.find(p=>p.id===id)
  const created=kind==='create'?createdPin(attempt,map):undefined
  selected.value=map;pendingPinSave.value=null;blocked.value=false;error.value=''
  // Only offer undo for an acknowledged, isolated revision of our own write.
  pinUndo.value=remember&&attempt.acknowledged&&map.revision===before.revision+1?(created?{mapId:map.id,revision:map.revision,kind:'remove',pin:created}:previous?{mapId:map.id,revision:map.revision,kind:kind==='remove'?'recreate':'restore',pin:previous}:null):null
  if(created){closeNote();selectedPin.value=created.id}
  if(kind==='remove'&&selectedPin.value===id)closeNote()
  if(mode.value==='pin'&&pinDraft.value&&editingPin.value===id&&samePinValues(pinDraft.value,attempt.value))discardDraft()
  notice.value=kind==='remove'?'Pin deleted. Its notebook entry is kept.':kind==='create'?'Pin placed.':'Pin saved.'
}
function keepPinDraft(attempt:PinSaveAttempt) {
  if(attempt.kind==='remove'||mode.value==='pin')return
  mode.value='pin';editingPin.value=attempt.id;pinDraft.value=pinValues(attempt.value)
  baseline.value=JSON.stringify(attempt.kind==='update'?pinValues(attempt.before.pins.find(p=>p.id===attempt.id)!):null)
  pinPanelCollapsed.value=false;locating.value=false
}
async function reconcilePinSave(attempt:PinSaveAttempt,run:number,originalError?:unknown) {
  try {
    const map=await api.get<RoomMap>(path(`/${attempt.before.id}`))
    if(disposed||run!==openRun)return false
    const outcome=pinSaveOutcome(attempt,map)
    if(outcome==='saved'){finishPinSave(attempt,map);return true}
    selected.value=map;pinUndo.value=null;keepPinDraft(attempt)
    if(outcome==='retry') {
      pendingPinSave.value=null;blocked.value=false
      const message=originalError instanceof Error?originalError.message:'The pin was not saved.'
      error.value=message+' Your changes are kept and the latest map is loaded. '+(attempt.kind==='remove'?'You can try deleting the pin again.':'Review your draft, then choose Save pin to try again.')
    } else {
      blocked.value=true
      error.value='The map changed while this save was being checked. Your draft is kept, but the save could not be confirmed. Check again, or reload and review the latest pins before making another change.'
    }
  } catch(e) {
    if(!disposed&&run===openRun){blocked.value=true;failure(e);if(selected.value){keepPinDraft(attempt);error.value+=' Your draft is kept. Use Check save to reconnect without reopening the map.'}}
  }
  return false
}
async function checkPinSave() {
  if(!pendingPinSave.value||saving.value)return
  const attempt=pendingPinSave.value,run=openRun;busy.value=true
  try{await reconcilePinSave(attempt,run)}finally{busy.value=false}
}
async function changePin(kind:'create'|'update'|'remove',value:MapPinDraft,id='',remember=true) {
  if(!selected.value||!canManage.value||saving.value||interacting.value||blocked.value)return false
  const before=selected.value,run=openRun
  const attempt:PinSaveAttempt={kind,before,value:pinValues(value),id,remember,acknowledged:false,rejected:false}
  busy.value=true;error.value='';notice.value='';menu.value=null
  if(kind==='update')selected.value={...before,pins:before.pins.map(p=>p.id===id?{...p,...value}:p)}
  try {
    const url=path(`/${before.id}/pins${id?'/'+id:''}`),body={expectedRevision:before.revision,pin:attempt.value}
    if(kind==='create')await api.post(url,body)
    else if(kind==='update')await api.patch(url,body)
    else await api.post(url+'/remove',{expectedRevision:before.revision})
    attempt.acknowledged=true
    const map=await api.get<RoomMap>(path(`/${before.id}`))
    if(disposed||run!==openRun)return false
    finishPinSave(attempt,map)
    return true
  }catch(e){
    if(disposed||run!==openRun)return false
    selected.value=before;pinUndo.value=null
    if(e instanceof ApiError&&[401,403,404].includes(e.status)){failure(e);return false}
    attempt.rejected=!attempt.acknowledged&&e instanceof ApiError&&[400,409,413,429].includes(e.status)
    pendingPinSave.value=attempt;blocked.value=true
    return await reconcilePinSave(attempt,run,e)
  }
  finally{busy.value=false}
}
async function savePin() {if(!pinDraft.value||invalidPinSharing.value)return;const id=editingPin.value;if(await changePin(id?'update':'create',pinDraft.value,id)){discardDraft();if(drawer.value&&currentPin.value?.noteTitle)void loadNote(currentPin.value.entryId)}}
async function movePin(id:string,position:{x:number;y:number}) {
  if(mode.value!=='read')return
  const pin=selected.value?.pins.find(p=>p.id===id);if(!pin||pin.x===position.x&&pin.y===position.y)return
  if(drawer.value&&selectedPin.value!==id){if(!mayLeave())return;closeNote()}
  selectedPin.value=id
  if(await changePin('update',{...pinValues(pin),...position},id)){notice.value=pinUndo.value?'Pin moved. Undo is available.':'Pin moved.';await nextTick();canvas.value?.focusPin(id)}
}
async function removePin() {
  if(!currentPin.value||!mayLeave()||blocked.value||!window.confirm('Delete this map pin? Its notebook entry is kept. You can undo this deletion.'))return
  await changePin('remove',currentPin.value,currentPin.value.id)
}
async function undoPin() {
  const undo=pinUndo.value
  if(!undo||!selected.value||saving.value||!mayLeave())return
  if(undo.mapId!==selected.value.id||undo.revision!==selected.value.revision){pinUndo.value=null;notice.value='The map changed elsewhere. Undo is no longer available.';return}
  if(await changePin(undo.kind==='remove'?'remove':undo.kind==='recreate'?'create':'update',undo.pin,undo.kind==='recreate'?'':undo.pin.id,false)){notice.value='Last pin change undone.';if(drawer.value&&currentPin.value?.noteTitle)void loadNote(currentPin.value.entryId)}
}
function cancelNoteDrag(){if(dragSource&&dragStart&&dragSource.hasPointerCapture(dragStart.pointer))dragSource.releasePointerCapture(dragStart.pointer);dragSource=null;dragStart=null;noteDrag.value=null;interacting.value=false}
function noteDown(entry:NotebookSummary,event:PointerEvent){if(event.button!==0||saving.value||blocked.value||mode.value!=='read'||interacting.value)return;event.preventDefault();dragSource=event.currentTarget as HTMLElement;dragStart={x:event.clientX,y:event.clientY,pointer:event.pointerId};noteDrag.value={entry,x:event.clientX,y:event.clientY,moved:false};dragSource.setPointerCapture(event.pointerId);interacting.value=true;menu.value=null}
function noteMove(event:PointerEvent){if(!noteDrag.value||!dragStart||event.pointerId!==dragStart.pointer)return;noteDrag.value.x=event.clientX;noteDrag.value.y=event.clientY;if(Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>5)noteDrag.value.moved=true}
async function noteUp(event:PointerEvent){if(!noteDrag.value||!dragStart||event.pointerId!==dragStart.pointer)return;const drag=noteDrag.value,position=canvas.value?.positionAt(event.clientX,event.clientY);cancelNoteDrag();if(drag.moved){if(position)await dropNote(drag.entry,position);else notice.value='Drop the note on the map image to place a pin.'}else startNotePlacement(drag.entry)}
async function dropNote(entry:NotebookSummary,position:{x:number;y:number}){if(mode.value!=='read'||!mayLeave())return;await changePin('create',{label:entry.title,entryId:entry.id,...position})}
function startNotePlacement(entry:NotebookSummary){if(!mayLeave())return;editPin();if(pinDraft.value){chooseNote(entry);locating.value=true}}
function closePopup(){if(!mayLeave())return;menu.value=null;popupOpen.value=false}
function showPopup(){returnFocus=document.activeElement as HTMLElement;popupOpen.value=true}
function restoreScroll(){if(previousOverflow!==undefined){document.body.style.overflow=previousOverflow;previousOverflow=undefined}}
watch([popupOpen,()=>props.active,popup],async()=>{
  await nextTick();const element=popup.value,show=popupOpen.value&&props.active!==false
  if(show&&element&&!element.open){returnFocus=document.activeElement as HTMLElement;if(previousOverflow===undefined)previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();await nextTick();canvas.value?.measure();if(canManage.value)void findNotes()}
  else if(!show){element?.close();restoreScroll();menu.value=null;cancelNoteDrag();returnFocus?.focus({preventScroll:true})}
},{flush:'post'})
function dismissMenu(focus=false){const id=menu.value?.id;menu.value=null;if(focus&&id)canvas.value?.focusPin(id)}
async function pinMenu(id:string,x:number,y:number){if(saving.value||blocked.value||!mayLeave())return;if(drawer.value&&selectedPin.value!==id)closeNote();selectedPin.value=id;const bounds=popup.value?.getBoundingClientRect();if(!bounds)return;menu.value={id,x:Math.max(bounds.left+8,Math.min(x,bounds.right-228)),y:Math.max(bounds.top+8,Math.min(y,bounds.bottom-320))};await nextTick();const r=menuPanel.value?.getBoundingClientRect();if(r&&menu.value){menu.value.x=Math.max(bounds.left+8,Math.min(menu.value.x,bounds.right-r.width-8));menu.value.y=Math.max(bounds.top+8,Math.min(menu.value.y,bounds.bottom-r.height-8))}menuPanel.value?.querySelector<HTMLButtonElement>('button')?.focus()}
function menuFromButton(id:string,event:MouseEvent){const r=(event.currentTarget as HTMLElement).getBoundingClientRect();void pinMenu(id,r.left,r.bottom)}
function menuKeys(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissMenu(true);return}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...menuPanel.value!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}
function pinAction(action:'read'|'notebook'|'center'|'edit'|'move'|'delete'){const pin=currentPin.value;dismissMenu();if(!pin)return;if(action==='read')openPin(pin.id);else if(action==='center'){canvas.value?.centerPin(pin.id);canvas.value?.focusPin(pin.id)}else if(action==='notebook'){if(mayLeave()){popupOpen.value=false;emit('openNotebook',pin.entryId)}}else if(action==='delete')void removePin();else{editPin(true);if(action==='move')locating.value=true}}
function popupPointer(event:PointerEvent){if(menu.value&&!(event.target as HTMLElement).closest('.map-pin-menu'))dismissMenu()}
async function toggleFocus() {
  if(navigationBusy.value)return
  menu.value=null;focusMap.value=!focusMap.value
  await nextTick();canvas.value?.measure();focusToggle.value?.focus({preventScroll:true})
}
function popupEscape(event:Event){event.preventDefault();if(menu.value)dismissMenu(true);else if(focusMap.value)void toggleFocus();else closePopup()}
async function deleteMap(map: MapSummary | null = selected.value) {
  if (!map || navigationBusy.value || opening.value || !canManage.value) return
  const {id, title, revision} = map
  if (!window.confirm(`Permanently delete “${title}” and all its pins? Notebook entries are kept. This cannot be undone.`)) return
  busy.value = true; deletingMap.value = id; error.value = ''; notice.value = `Deleting “${title}”…`
  try {
    await api.post(path(`/${id}/delete`), {expectedRevision: revision})
    if (selected.value?.id === id) clearSelected()
    if (index.value) index.value.maps = index.value.maps.filter(map => map.id !== id)
    notice.value = `“${title}” deleted. Notebook entries were kept.`
    await loadIndex()
    browse.value = true
    await nextTick()
    mapSearch.value?.focus({preventScroll: true})
  } catch (e) {notice.value = ''; failure(e)} finally {busy.value = false; deletingMap.value = ''}
}
function openNotebook() {if (note.value && mayLeave()) {popupOpen.value=false;emit('openNotebook', note.value.id)}}
function beforeUnload(event: BeforeUnloadEvent) {if (dirty.value || navigationBusy.value) {event.preventDefault(); event.returnValue = ''}}
const refreshVisible = () => {void refresh()}
watch(() => props.active, value => {if(value) void refresh()})
onMounted(() => {void loadIndex(); poll = setInterval(refreshVisible,15000); window.addEventListener('focus', refreshVisible); document.addEventListener('visibilitychange',refreshVisible); window.addEventListener('beforeunload',beforeUnload)})
onUnmounted(() => {disposed = true; indexRun++; openRun++; noteRun++; searchRun++; cancelNoteDrag();popup.value?.close();restoreScroll();releaseImage(); clearInterval(poll); clearTimeout(searchTimer); window.removeEventListener('focus',refreshVisible); document.removeEventListener('visibilitychange',refreshVisible); window.removeEventListener('beforeunload',beforeUnload)})
</script>
<template>
  <section class="room-maps" aria-label="Room maps">
    <header class="map-toolbar"><div><h2>Campaign maps</h2><p class="sheet-small">Open a map to explore and arrange its notebook pins.</p></div><div class="map-actions"><button type="button" class="sheet-button map-browse" @click="browse=!browse">{{browse?'Hide map list':'Browse maps'}}</button><button type="button" class="sheet-button" :disabled="loading||navigationBusy||opening" @click="refresh">Refresh maps</button><button v-if="canManage" class="sheet-button sheet-button-primary" type="button" :disabled="navigationBusy" @click="upload">Upload map</button></div></header>
    <p v-if="error&&!popupOpen" class="sheet-alert" role="alert">{{error}}</p><p v-if="notice&&!popupOpen" class="sheet-small" role="status">{{notice}}</p>
    <p v-if="index?.readOnly" class="sheet-notice">Player preview is read-only. Maps and pins follow this player’s notebook access.</p>
    <div class="map-layout" :data-browse="browse">
      <aside class="map-index"><label>Find map<input ref="mapSearch" v-model="search" type="search" placeholder="Search by name" /></label><div class="map-index-scroll">
        <div v-for="map in maps" :key="map.id" class="map-list-row">
          <button class="sheet-button map-list-entry" type="button" :aria-current="selected?.id===map.id?'true':undefined" :disabled="navigationBusy" @click="openMap(map.id)"><strong>{{map.title}}</strong><small>{{audience(map.audience)}}</small></button>
          <button v-if="canManage" class="sheet-button map-list-delete" type="button" :aria-label="`Delete ${map.title}`" :title="`Delete ${map.title}`" :aria-busy="deletingMap===map.id" :disabled="navigationBusy||opening" @click="deleteMap(map)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg></button>
        </div>
        <p v-if="loading&&!index" class="sheet-small" role="status">Loading maps…</p><p v-else-if="!maps.length" class="sheet-small">{{search?'No matching maps.':canManage?'Upload your first map to link campaign locations.':'No maps have been shared yet.'}}</p></div><p v-if="index?.storage" class="map-storage sheet-small">Room images: {{mib(index.storage.roomBytes)}} / 10 MiB<br />Your images: {{mib(index.storage.ownerBytes)}} / 25 MiB</p></aside>
      <div class="map-workspace" v-motion-panel="`${selected?.id}:${mode}`">
        <form v-if="draft&&mode==='upload'" class="sheet-panel map-editor" @submit.prevent="saveMap"><header class="map-toolbar"><h3>Upload map</h3><button class="sheet-button sheet-small-button" type="button" :disabled="saving" @click="mayLeave">Cancel</button></header><label>Map name<input v-model="draft.title" maxlength="120" required :disabled="saving" /></label><label>Map image<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="saving" @change="chooseImage" /></label><p class="sheet-small">PNG, JPEG or WebP up to 20 MiB and 16 megapixels. Prepared at high quality, up to 4096 pixels and 3 MiB. Only the prepared copy is stored.</p><p v-if="optimizing" role="status" class="sheet-small">Preparing image…</p><p v-if="uploadDetails" class="sheet-small" role="status">{{uploadDetails}}</p><img v-if="uploadPreview" class="map-upload-preview" :src="uploadPreview" :alt="uploadName" /><label>Who can open this map?<select v-model="draft.audience" :disabled="saving"><option value="dm">DM only</option><option value="room">Whole room</option><option value="characters">Selected characters</option></select></label><fieldset v-if="draft.audience==='characters'" class="map-sharing"><legend>Characters</legend><label v-for="character in index?.characters" :key="character.id"><input v-model="draft.characterIds" type="checkbox" :value="character.id" :disabled="saving" />{{character.name}}{{character.assigned?'':' (unassigned)'}}</label></fieldset><p class="sheet-small">Share a player-safe image: hiding a pin cannot hide spoilers already drawn on the map. Pins appear only when their linked note is also shared.</p><button class="sheet-button sheet-button-primary" type="submit" :disabled="saving||!draft.title.trim()||draft.audience==='characters'&&!draft.characterIds.length||!uploadImage">{{busy?'Saving…':'Save map'}}</button></form>
        <div v-else-if="selected" class="sheet-panel map-welcome map-preview-card"><h3>{{selected.title}}</h3><p class="sheet-small">{{audience(selected.audience)}} · {{selected.pins.length}} locations</p><button class="map-preview-open" type="button" :disabled="opening" @click="showPopup"><img v-if="imageUrl&&!imageFailure" :src="imageUrl" :alt="selected.title" /><span>{{opening?'Opening map…':'Open large map'}}</span></button></div>
        <div v-else class="sheet-panel map-welcome"><h3>{{opening?'Opening map…':'Your campaign, mapped'}}</h3><p class="sheet-prose">{{canManage?'Choose a map or upload an image. Drag notebook entries onto the large map to create pins. Players see only the locations shared with them.':'Choose a shared map to explore its locations and read the linked notes.'}}</p></div>
      </div>
    </div>
    <Teleport to=".site-shell">
      <dialog v-if="selected" ref="popup" class="room-maps hero-sheet map-popup" :data-focus="focusMap" :data-city-expanded="cityExpanded&&showingCity" :aria-labelledby="popupTitle" @cancel="popupEscape" @close="popupOpen=false;restoreScroll()" @pointerdown.capture="popupPointer">
        <header class="map-popup-heading"><div><h2 :id="popupTitle">{{selected.title}}</h2><p class="sheet-small">{{audience(selected.audience)}} · {{canManage?'DM workspace':index?.readOnly?'Player preview':'Shared map'}}</p></div><div class="map-actions"><button ref="focusToggle" class="sheet-button sheet-small-button map-focus-toggle" type="button" :aria-pressed="focusMap" :disabled="navigationBusy" @click="toggleFocus">{{focusMap?'Show panels':'Focus map'}}</button><button v-if="canManage" class="sheet-button sheet-small-button map-secondary-action" type="button" :aria-pressed="noteTray" :disabled="navigationBusy" @click="noteTray=!noteTray">Notebook entries</button><button v-if="canManage" class="sheet-button sheet-small-button map-secondary-action" type="button" :disabled="navigationBusy||blocked" @click="editRegions">Edit regions</button><button v-if="canManage" class="sheet-button sheet-small-button map-secondary-action" type="button" :disabled="navigationBusy||blocked" @click="settings">Map settings</button><button class="sheet-button sheet-small-button" type="button" :disabled="navigationBusy" aria-label="Close map" @click="closePopup">×</button></div></header>
        <div v-if="error||blocked" class="sheet-alert map-popup-feedback" role="alert">{{error||'Reload this map before making another change.'}} <button v-if="pendingPinSave" type="button" class="sheet-button sheet-small-button" :disabled="saving" @click="checkPinSave">{{saving?'Checking save…':'Check save'}}</button> <button type="button" class="sheet-button sheet-small-button" :disabled="saving" @click="openMap(selected.id)">Reload map</button></div>
        <p v-if="focusMap&&(mode==='pin'||mode==='regions'||mode==='settings')" class="map-focus-draft sheet-small" role="status">Unsaved {{mode==='pin'?'pin':mode==='regions'?'border':'map'}} settings are kept. Show panels to save or cancel.</p>
        <div class="map-popup-workspace" :data-tray="!focusMap&&canManage&&noteTray&&mode==='read'">
          <aside v-if="canManage&&noteTray&&mode==='read'" class="map-note-tray"><h3>Notebook entries</h3><p class="sheet-small">Drag an entry onto the map. Or select one, then select its location.</p><label>Find entry<input v-model="noteQuery" type="search" placeholder="Journal and Story items" :disabled="saving||blocked" /></label><p v-if="searchBusy" class="sheet-small" role="status">Finding entries…</p><div class="map-tray-results"><button v-for="entry in noteResults" :key="entry.id" class="sheet-button map-note-card" type="button" :disabled="saving||blocked" @pointerdown="noteDown(entry,$event)" @pointermove="noteMove" @pointerup="noteUp" @pointercancel="cancelNoteDrag" @lostpointercapture="cancelNoteDrag" @click="($event.detail===0)&&startNotePlacement(entry)"><strong>{{entry.title}}</strong><small>{{entry.section==='journal'?'Journal':'Story item'}} · {{audience(entry.audience)}}</small><small v-if="selected.pins.some(p=>p.entryId===entry.id)">Already pinned</small></button><p v-if="!searchBusy&&!noteResults.length" class="sheet-small">No entries found. Add one in Campaign notebook first.</p><p v-if="noteResults.length===80" class="sheet-small">Showing the first 80 matches. Search to narrow the list.</p></div></aside>
          <div class="map-popup-main">
            <form v-if="draft&&mode==='settings'" class="sheet-panel map-editor" @submit.prevent="saveMap"><header class="map-toolbar"><h3>Map settings</h3><button class="sheet-button sheet-small-button" type="button" :disabled="saving" @click="mayLeave">Cancel</button></header><label>Map name<input v-model="draft.title" maxlength="120" required :disabled="saving" /></label><label>Who can open this map?<select v-model="draft.audience" :disabled="saving"><option value="dm">DM only</option><option value="room">Whole room</option><option value="characters">Selected characters</option></select></label><fieldset v-if="draft.audience==='characters'" class="map-sharing"><legend>Characters</legend><label v-for="character in index?.characters" :key="character.id"><input v-model="draft.characterIds" type="checkbox" :value="character.id" :disabled="saving" />{{character.name}}{{character.assigned?'':' (unassigned)'}}</label></fieldset><p class="sheet-small">Pin visibility also depends on access to the map and linked note. Hiding pins does not hide spoilers drawn into the image.</p><footer class="map-actions"><button class="sheet-button sheet-button-primary" type="submit" :disabled="saving||!draft.title.trim()||draft.audience==='characters'&&!draft.characterIds.length">{{busy?'Saving…':'Save map'}}</button><button class="sheet-button" type="button" :disabled="saving" @click="deleteMap()">Delete map</button></footer></form>
            <MapRegionEditor v-if="mode==='regions'" v-model="regionDraft" :active="activeRegion" :point="regionPoint" :drawing="regionDrawing" :disabled="saving||blocked" @add="drawRegion" @finish="finishRegion" @save="saveRegions" @cancel="mayLeave" @select-point="regionPoint=$event" @move-point="moveRegionPoint" @remove-point="removeRegionPoint" @remove-region="deleteRegion" @undo="draftRegion?.points.pop()" />
            <div class="map-stage" :data-city="showingCity" :data-drawer="mode==='pin'?!pinPanelCollapsed:drawer">
              <div class="map-main"><p v-if="opening" role="status" class="sheet-small">Opening map…</p><p v-if="mode==='pin'" role="status" class="map-placement-hint">Drag the highlighted pin to move it. Use Choose location on map to place it directly, then Save pin.</p><MapCanvas v-if="imageUrl&&!imageFailure" :key="selected.id" ref="canvas" :map="selected" :focused="focusMap" :image-url="imageUrl" :placing="locating&&!saving" :can-manage="canManage&&(mode==='read'||mode==='pin')&&!blocked" :disabled="saving||blocked" :selected-pin="selectedPin" :draft-position="pinDraft" :editing-pin="editingPin" :draft-label="pinDraft?.label" :draft-display="pinDraft?.display" :drawer-open="drawer||mode==='pin'" :regions="mode==='regions'?regionDraft:selected.regions??[]" :active-region="activeRegion" :editing-regions="mode==='regions'" :drawing-region="regionDrawing" :selected-region-point="regionPoint" @select-region="selectRegion" @region-point="addRegionPoint" @move-region-point="moveRegionPoint" @insert-region-point="insertRegionPoint" @select-region-point="regionPoint=$event" @remove-region-point="removeRegionPoint" @open="openPin" @place="place" @move-pin="movePin" @move-draft="moveDraft" @context="pinMenu" @gesture="interacting=$event" @image-error="imageFailure=true" /><p v-if="imageFailure" class="sheet-alert">The map image could not be opened. <button class="sheet-button" type="button" @click="openMap(selected.id)">Retry image</button></p></div>
              <div class="map-location-bar"><button v-if="canManage" class="sheet-button sheet-small-button" type="button" :disabled="saving||blocked||interacting" @click="editPin(false)">Add note pin</button><details class="map-location-list"><summary>Locations ({{selected.pins.length}})</summary><div class="map-locations"><div v-for="pin in selected.pins" :key="pin.id" class="map-location-entry"><button class="sheet-button sheet-small-button" type="button" :aria-pressed="selectedPin===pin.id" :disabled="navigationBusy" @click="openPin(pin.id,true)"><span class="map-location-symbol map-pin-sample" :data-pin-color="pinDisplay(pin).color"><MapPinGlyph :symbol="pinDisplay(pin).symbol" :number="selected.pins.indexOf(pin)+1" /></span>{{pin.label}}{{!pin.noteTitle?' (relink needed)':''}}</button><button class="sheet-button sheet-small-button" type="button" :aria-label="`Options for ${pin.label}`" aria-haspopup="menu" :disabled="navigationBusy" @click="menuFromButton(pin.id,$event)">⋯</button></div><p v-if="!selected.pins.length" class="sheet-small">No shared locations yet.</p></div></details><button v-if="currentPin" class="sheet-button sheet-small-button" type="button" aria-haspopup="menu" :disabled="navigationBusy" @click="menuFromButton(currentPin.id,$event)">Pin options</button></div>
              <form v-if="mode==='pin'&&pinDraft" class="sheet-panel map-drawer map-pin-editor" :data-collapsed="pinPanelCollapsed" @submit.prevent="savePin"><header class="map-toolbar"><h3>{{editingPin?'Edit note pin':'New note pin'}}</h3><button type="button" class="sheet-button sheet-small-button" :aria-expanded="!pinPanelCollapsed" :aria-controls="popupTitle+'-pin-fields'" :disabled="navigationBusy" @click="pinPanelCollapsed=!pinPanelCollapsed">{{pinPanelCollapsed?'Show settings':'Hide settings'}}</button><button type="button" class="sheet-button sheet-small-button" :disabled="navigationBusy" @click="mayLeave">Cancel</button></header><div v-show="!pinPanelCollapsed" :id="popupTitle+'-pin-fields'" class="map-pin-editor-body"><div class="map-pin-fields"><label>Pin name<input v-model="pinDraft.label" required maxlength="120" :disabled="saving||blocked" /></label><div class="map-coordinate-fields"><label>Across (%)<input type="number" min="0" max="100" step=".1" :value="Math.round(pinDraft.x*1000)/10" :disabled="saving||blocked" @input="coordinate('x',$event)" /></label><label>Down (%)<input type="number" min="0" max="100" step=".1" :value="Math.round(pinDraft.y*1000)/10" :disabled="saving||blocked" @input="coordinate('y',$event)" /></label></div></div><div class="map-actions"><button class="sheet-button sheet-small-button" type="button" :aria-pressed="locating" :disabled="saving||blocked" @click="chooseLocation">{{locating?'Choosing location…':'Choose location on map'}}</button></div><section class="map-pin-sharing"><label>Who can see this pin?<select aria-label="Who can see this pin?" v-model="pinDraft.audience" :disabled="saving||blocked"><option value="room">Whole room</option><option value="characters">Selected characters</option><option value="dm">DM only</option></select></label><fieldset v-if="pinDraft.audience==='characters'" class="map-sharing"><legend>Show for</legend><label v-for="character in pinCharacters" :key="character.id"><input v-model="pinDraft.characterIds" type="checkbox" :value="character.id" :disabled="saving||blocked" />{{character.name}}{{character.assigned?'':' (no longer assigned)'}}</label><p v-if="!assignedCharacters.length" class="sheet-small">Assign a character to a player in Players &amp; assignments first.</p></fieldset><p class="sheet-small">Players also need access to the map and linked notebook entry. Sharing a pin does not share its note.</p></section><PinDisplaySettings v-if="pinDraft.display" v-model="pinDraft.display" :disabled="saving||blocked" /><details class="map-relink" :open="!pinDraft.entryId"><summary>{{pinDraft.entryId?'Change linked notebook entry':'Choose a notebook entry'}}</summary><label>Find entry<input v-model="noteQuery" type="search" placeholder="Journal and Story items" :disabled="saving||blocked" /></label><div class="map-note-results"><button v-for="entry in noteResults" :key="entry.id" class="sheet-button map-list-entry" type="button" :aria-pressed="pinDraft.entryId===entry.id" :disabled="saving||blocked" @click="chooseNote(entry)"><strong>{{entry.title}}</strong><small>{{audience(entry.audience)}}</small></button></div></details><p class="sheet-small">Drag the highlighted pin to adjust its position. Choose Save pin to keep changes. Pins follow access to their linked entry.</p></div><footer class="map-actions"><span v-if="pinPanelCollapsed" class="sheet-small">Drag the highlighted pin to move it.</span><button class="sheet-button sheet-button-primary" type="submit" :disabled="navigationBusy||blocked||!pinDraft.entryId||!pinDraft.label.trim()||invalidPinSharing">{{busy?'Saving…':'Save pin'}}</button></footer></form>
              <MapCityLibrary v-else-if="showingCity&&currentCity" ref="cityPanel" :key="currentCity.entryId" :room-id="roomId" :library="currentCity" :region="cityRegion" :note="note" :note-busy="noteBusy" :note-error="noteError" :can-manage="canManage" :expanded="cityExpanded" :disabled="saving||interacting" @close="closeCity" @expand="cityExpanded=!cityExpanded" @read="loadNote" @notebook="openNotebook" @saved="citySaved" @removed="cityRemoved" @reload="currentPin&&loadCity(currentPin.entryId)" />
              <aside v-else-if="drawer" class="sheet-panel map-drawer" aria-label="Location note" v-motion-panel="note?.id"><header class="map-toolbar"><h3>{{note?.title??currentPin?.label??'Location note'}}</h3><button class="sheet-button sheet-small-button" type="button" @click="closeNote">Close note</button></header><p v-if="noteBusy" class="sheet-small" role="status">Opening entry…</p><p v-if="noteError" class="sheet-alert" role="alert">{{noteError}}</p><div v-if="note" class="map-note-scroll notebook-prose"><NotebookText :body="note.body" :links="note.connections" @open="loadNote" /></div><div v-if="note?.connections.length" class="map-actions"><button v-for="link in note.connections" :key="link.id" class="sheet-button sheet-small-button" type="button" @click="loadNote(link.id)">{{link.title}}</button></div><footer class="map-note-footer"><button v-if="canManage&&currentPin&&note?.id===currentPin.entryId&&!currentPin.cityLibrary" class="sheet-button sheet-small-button" type="button" :disabled="navigationBusy" @click="createCity">Use as city library</button><button v-if="note" class="sheet-button sheet-small-button" type="button" @click="openNotebook">Open in notebook</button></footer></aside>
            </div>
          </div>
        </div>
        <footer class="map-popup-footer"><span role="status">{{busy?'Saving changes…':mode==='pin'?'Pin changes are a draft. Choose Save pin to keep them.':mode==='regions'?'Border changes are a draft. Choose Save borders to keep them.':notice||'Drag a pin to move it. Changes save when you drop.'}}</span><button v-if="canManage" class="sheet-button sheet-small-button" type="button" :disabled="!pinUndo||navigationBusy||blocked" @click="undoPin">Undo last pin change</button></footer>
        <div v-if="menu&&currentPin" ref="menuPanel" class="map-pin-menu" role="menu" :aria-label="`Options for ${currentPin.label}`" :style="{left:`${menu.x}px`,top:`${menu.y}px`}" @keydown="menuKeys" @focusout="!menuPanel?.contains($event.relatedTarget as Node)&&dismissMenu()"><strong>{{currentPin.label}}</strong><button role="menuitem" type="button" @click="pinAction('read')">Read linked note</button><button role="menuitem" type="button" :disabled="!currentPin.noteTitle" @click="pinAction('notebook')">Open in notebook</button><button role="menuitem" type="button" @click="pinAction('center')">Centre on pin</button><template v-if="canManage"><hr /><button role="menuitem" type="button" @click="pinAction('edit')">Edit pin settings</button><button role="menuitem" type="button" @click="pinAction('move')">Choose a new location</button><button role="menuitem" type="button" class="map-delete-pin" @click="pinAction('delete')">Delete pin</button></template></div>
        <div v-if="noteDrag?.moved" class="map-drag-note" aria-hidden="true" :style="{left:`${noteDrag.x+12}px`,top:`${noteDrag.y+12}px`}">{{noteDrag.entry.title}}</div>
      </dialog>
    </Teleport>
  </section>
</template>
