<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {pinDisplay, pinZoom, type MapPinDisplay, type MapRegion, type RoomMap} from '../../../shared/room-maps'
import MapPinGlyph from './MapPinGlyph.vue'
import MapRegionLayer from './MapRegionLayer.vue'
import {inRegion,regionBounds} from '../../../shared/map-regions'
type Position = {x: number; y: number}
const props = defineProps<{map: RoomMap; imageUrl: string; placing: boolean; selectedPin: string; drawerOpen: boolean; canManage?: boolean; disabled?: boolean; draftPosition?: Position | null; editingPin?: string; draftLabel?: string; draftDisplay?: MapPinDisplay; regions?:MapRegion[]; activeRegion?:string; editingRegions?:boolean; drawingRegion?:boolean; selectedRegionPoint?:number; focused?:boolean}>()
const emit = defineEmits<{open: [id: string]; place: [position: Position]; movePin: [id: string, position: Position]; moveDraft: [position: Position]; context: [id: string, x: number, y: number]; gesture: [active: boolean]; imageError: []; selectRegion:[id:string]; regionPoint:[position:Position]; moveRegionPoint:[index:number,position:Position]; insertRegionPoint:[index:number,position:Position]; selectRegionPoint:[index:number]; removeRegionPoint:[]}>()
const draftId = '__draft__'
const pins = computed(() => {
  const result = props.map.pins.map(pin => pin.id === props.editingPin && props.draftPosition ? {...pin, ...props.draftPosition, label: props.draftLabel || pin.label, display: props.draftDisplay ?? pinDisplay(pin)} : pin)
  if (props.draftPosition && !props.editingPin) result.push({id: draftId, label: props.draftLabel || 'New note pin', entryId: '', noteTitle: null, ...props.draftPosition, display: props.draftDisplay ?? pinDisplay()})
  return result.map((pin,index)=>({...pin,display:pinDisplay(pin),number:index+1}))
})
const isDraft = (id: string) => !!props.draftPosition && (id === props.editingPin || id === draftId)
const canDrag = (id: string) => !!props.canManage && !props.disabled && (!props.draftPosition || isDraft(id))
function commitPosition(id: string, position: Position) {if (isDraft(id)) emit('moveDraft', position); else emit('movePin', id, position)}
const viewport = ref<HTMLElement | null>(null), plane = ref<HTMLElement | null>(null)
const size = ref({width: 0, height: 0}), offset = ref({x: 0, y: 0}), zoom = ref(1), dragging = ref(false), baseScale = ref(1)
const movingPin = ref(''), movingPosition = ref<Position | null>(null)
const showAll = ref(false), atlas=ref(true), showBorders=ref(true)
const regions=computed(()=>props.regions??[]), currentRegion=computed(()=>regions.value.find(r=>r.id===props.activeRegion))
// Region selection focuses the camera; it does not filter locations.
const shownPins = computed(() => props.editingRegions?[]:pins.value.filter(pin => isDraft(pin.id) || movingPin.value===pin.id || props.canManage && showAll.value || pin.display.visibility==='always' || zoom.value + .0001 >= pinZoom(pin.display)))
const visibleCount = computed(() => shownPins.value.filter(pin=>pin.id!==draftId).length)
const scale = computed(() => baseScale.value * zoom.value)
const style = computed(() => ({width: `${props.map.width}px`, height: `${props.map.height}px`, transform: `translate(${offset.value.x}px,${offset.value.y}px) scale(${scale.value})`}))
let observer: ResizeObserver, pointer: {id: number; pin: string; regionId?:string; vertex?:number; x: number; y: number; ox: number; oy: number; px: number; py: number; moved: boolean} | null = null
let suppressClickUntil = 0
let cameraFrame=0, skipRegionFocus=false
function stopCamera(){cancelAnimationFrame(cameraFrame);cameraFrame=0}
function fit(clear=true) {stopCamera();if (!size.value.width) return;if(clear&&!props.editingRegions)emit('selectRegion','');baseScale.value = Math.max(.01, Math.min((size.value.width - 32) / props.map.width, (size.value.height - 32) / props.map.height)); zoom.value = 1; offset.value = {x: (size.value.width - props.map.width * scale.value) / 2, y: (size.value.height - props.map.height * scale.value) / 2}}
function focusZoom(region:MapRegion){if(region.points.length<3)return 1;const b=regionBounds(region);return Math.max(1,Math.min(8,Math.min(Math.max(50,size.value.width-80)/(Math.max(.001,b.width)*props.map.width),Math.max(50,size.value.height-80)/(Math.max(.001,b.height)*props.map.height))/baseScale.value))}
function centerRegion(id:string){const region=regions.value.find(r=>r.id===id);if(!region||region.points.length<3){if(!id)fit(false);return}const b=regionBounds(region),targetZoom=focusZoom(region),target={x:size.value.width/2-(b.x+b.width/2)*props.map.width*baseScale.value*targetZoom,y:size.value.height/2-(b.y+b.height/2)*props.map.height*baseScale.value*targetZoom};stopCamera();const start=performance.now(),from={zoom:zoom.value,...offset.value};if(matchMedia('(prefers-reduced-motion: reduce)').matches||viewport.value?.closest('[data-motion=reduced]')){zoom.value=targetZoom;offset.value=target;return}function frame(now:number){const t=Math.min(1,(now-start)/260),f=1-(1-t)**3;zoom.value=from.zoom+(targetZoom-from.zoom)*f;offset.value={x:from.x+(target.x-from.x)*f,y:from.y+(target.y-from.y)*f};if(t<1)cameraFrame=requestAnimationFrame(frame);else cameraFrame=0}cameraFrame=requestAnimationFrame(frame)}
function chooseRegion(id:string){if(props.drawingRegion||props.disabled)return;if(props.activeRegion===id)centerRegion(id);else emit('selectRegion',id)}
function zoomAt(factor: number, x = size.value.width / 2, y = size.value.height / 2) {stopCamera();const old = scale.value;zoom.value = Math.max(.5, Math.min(10, zoom.value * factor));const ratio = scale.value / old;offset.value = {x: x - (x - offset.value.x) * ratio, y: y - (y - offset.value.y) * ratio};if(zoom.value<=1.03&&!props.editingRegions)fit()}
function wheel(event: WheelEvent) {if(event.ctrlKey||event.metaKey||pointer)return;event.preventDefault();const rect = viewport.value!.getBoundingClientRect();zoomAt(Math.exp(-Math.max(-150, Math.min(150, event.deltaY)) * .002), event.clientX - rect.left, event.clientY - rect.top)}
function positionAt(clientX: number, clientY: number): Position | null {const view = viewport.value?.getBoundingClientRect(), rect = plane.value?.getBoundingClientRect();if (!view || !rect || clientX < view.left || clientX > view.right || clientY < view.top || clientY > view.bottom) return null;const x = (clientX - rect.left) / rect.width, y = (clientY - rect.top) / rect.height;return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? {x, y} : null}
function down(event: PointerEvent, pin = '') {
  if (event.button !== 0 || pointer || props.disabled) return
  if (pin && !canDrag(pin)) return
  event.preventDefault()
  stopCamera()
  const target = event.currentTarget as HTMLElement
  if(typeof target.focus==='function')target.focus({preventScroll: true})
  const existing = pins.value.find(p => p.id === pin)
  pointer = {id: event.pointerId, pin, x: event.clientX, y: event.clientY, ox: offset.value.x, oy: offset.value.y, px: existing?.x ?? 0, py: existing?.y ?? 0, moved: false}
  viewport.value?.setPointerCapture(event.pointerId);emit('gesture', true)
}
function regionDown(event:PointerEvent,id:string){down(event);if(pointer)pointer.regionId=id}
function vertexDown(event:PointerEvent,index:number){if(!props.editingRegions||props.disabled)return;const p=currentRegion.value?.points[index];if(!p)return;down(event);if(pointer){pointer.vertex=index;pointer.px=p.x;pointer.py=p.y;emit('selectRegionPoint',index)}}
function move(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId) return
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
  if (Math.hypot(dx,dy) > 5) {pointer.moved = true; dragging.value = true}
  if (!pointer.moved) return
  if(pointer.vertex!==undefined){emit('moveRegionPoint',pointer.vertex,{x:Math.max(0,Math.min(1,pointer.px+dx/(props.map.width*scale.value))),y:Math.max(0,Math.min(1,pointer.py+dy/(props.map.height*scale.value)))});return}
  if (pointer.pin) {movingPin.value = pointer.pin;movingPosition.value = {x: Math.max(0, Math.min(1, pointer.px + dx / (props.map.width * scale.value))), y: Math.max(0, Math.min(1, pointer.py + dy / (props.map.height * scale.value)))}}
  else offset.value = {x: pointer.ox + dx, y: pointer.oy + dy}
}
function up(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId) return
  // The release can arrive after the last sampled move (especially on touch).
  move(event)
  const current = pointer, position = movingPosition.value
  if(current.moved) suppressClickUntil = Date.now() + 350
  cancel()
  if(current.vertex!==undefined)return
  if(!current.moved&&props.drawingRegion){const point=positionAt(event.clientX,event.clientY);if(point)emit('regionPoint',point);return}
  if(!current.moved&&props.placing&&!current.pin){const point=positionAt(event.clientX,event.clientY);if(point)emit('place',point);return}
  if(!current.moved&&current.regionId){chooseRegion(current.regionId);return}
  if (current.pin) {if (current.moved && position) commitPosition(current.pin, position);else if (!isDraft(current.pin)) emit('open',current.pin)}
}
function cancel() {const active=pointer;pointer = null;dragging.value = false;movingPin.value='';movingPosition.value=null;if(active){if(viewport.value?.hasPointerCapture(active.id))viewport.value.releasePointerCapture(active.id);emit('gesture',false)}}
function captureLost(event: PointerEvent) {if(event.target===viewport.value&&event.pointerId===pointer?.id)cancel()}
function pointerCancelled(event: PointerEvent) {if(event.pointerId===pointer?.id)cancel()}
function open(id:string,event:MouseEvent) {if(props.disabled||isDraft(id)||Date.now()<suppressClickUntil)return;if(event.detail===0||!canDrag(id))emit('open',id)}
function context(event:MouseEvent,id:string) {event.preventDefault();event.stopPropagation();if(props.disabled||isDraft(id))return;cancel();emit('context',id,event.clientX,event.clientY)}
function pinKeys(event:KeyboardEvent,id:string) {
  if(props.disabled)return
  if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();if(isDraft(id))return;const r=(event.currentTarget as HTMLElement).getBoundingClientRect();emit('context',id,r.left+r.width/2,r.bottom);return}
  if(!canDrag(id)||!event.key.startsWith('Arrow'))return
  const pin=pins.value.find(p=>p.id===id);if(!pin)return
  const directions:Record<string,Position>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}},direction=directions[event.key]
  if(!direction)return;event.preventDefault();if(event.repeat)return
  const step=event.shiftKey?.025:.005
  commitPosition(id,{x:Math.max(0,Math.min(1,pin.x+direction.x*step)),y:Math.max(0,Math.min(1,pin.y+direction.y*step))})
}
function keyboard(event: KeyboardEvent) {if(props.editingRegions&&props.selectedRegionPoint!==undefined&&props.selectedRegionPoint>=0&&!(event.target as HTMLElement).closest('.map-region-midpoint')){const point=currentRegion.value?.points[props.selectedRegionPoint],directions:Record<string,Position>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}},direction=directions[event.key];if(point&&direction){event.preventDefault();const step=event.shiftKey?.005:.0005;emit('moveRegionPoint',props.selectedRegionPoint,{x:Math.max(0,Math.min(1,point.x+direction.x*step)),y:Math.max(0,Math.min(1,point.y+direction.y*step))});return}} if ((event.target as HTMLElement).closest('button')) return;const moves: Record<string, [number,number]> = {ArrowLeft: [50,0], ArrowRight: [-50,0], ArrowUp: [0,50], ArrowDown: [0,-50]};if (moves[event.key]) {event.preventDefault();const [x,y] = moves[event.key]!;offset.value = {x: offset.value.x + x, y: offset.value.y + y}}else if (event.key === '+' || event.key === '=') {event.preventDefault();zoomAt(1.25)}else if (event.key === '-') {event.preventDefault();zoomAt(.8)}}
function centerPin(id:string) {stopCamera();if(props.activeRegion){skipRegionFocus=true;emit('selectRegion','')}const p=props.map.pins.find(p=>p.id===id);if(p){zoom.value=Math.max(zoom.value,pinZoom(pinDisplay(p)));offset.value={x:size.value.width/2-p.x*props.map.width*scale.value,y:size.value.height/2-p.y*props.map.height*scale.value}}}
function thumbnail(region:MapRegion){const b=regionBounds(region);return `${b.x*props.map.width} ${b.y*props.map.height} ${Math.max(.001,b.width)*props.map.width} ${Math.max(.001,b.height)*props.map.height}`}
function focusPin(id:string) {viewport.value?.querySelector<HTMLButtonElement>(`[data-map-pin="${id}"]`)?.focus({preventScroll:true})}
function pinLeaving(element: Element) {if(element.contains(document.activeElement))viewport.value?.focus({preventScroll:true});(element as HTMLElement).inert=true}
function pinEntering(element: Element) {(element as HTMLElement).inert=false}
function pinPosition(id:string,x:number,y:number) {return id===movingPin.value&&movingPosition.value?movingPosition.value:{x,y}}
function measure() {const r=viewport.value?.getBoundingClientRect();if(!r?.width||!r.height)return;const previous=size.value;if(previous.width===r.width&&previous.height===r.height)return;const wasAnimating=!!cameraFrame;stopCamera();size.value={width:r.width,height:r.height};if(!previous.width)fit();else {offset.value={x:offset.value.x+(r.width-previous.width)/2,y:offset.value.y+(r.height-previous.height)/2};if(wasAnimating&&currentRegion.value&&!props.drawingRegion)centerRegion(currentRegion.value.id);else if(zoom.value<=1.03&&!props.drawingRegion)fit(false)}}
defineExpose({positionAt,centerPin,focusPin,fit,cancel,measure,centerRegion})
onMounted(() => {observer = new ResizeObserver(measure);if (viewport.value) observer.observe(viewport.value);measure();window.addEventListener('resize',measure);window.addEventListener('blur',cancel)})
watch(()=>props.activeRegion,id=>{if(skipRegionFocus){skipRegionFocus=false;return}if(!props.drawingRegion)centerRegion(id??'')})
watch(()=>regions.value.map(r=>r.id).join(','),()=>{if(props.activeRegion&&!currentRegion.value)emit('selectRegion','')})
watch(() => props.drawerOpen, async () => {await nextTick();measure()})
watch(() => props.map.id, () => {cancel();showAll.value=false;fit()})
watch(() => props.disabled,value=>{if(value)cancel()})
onUnmounted(() => {stopCamera();cancel();observer?.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('blur',cancel)})
</script>
<template>
  <div class="map-canvas-shell" :data-focused="!!focused">
    <div class="map-canvas-tools"><label v-if="focused&&regions.length" class="map-focus-region">Region<select aria-label="Region" :value="activeRegion??''" :disabled="disabled||drawingRegion" @change="($event.target as HTMLSelectElement).value?chooseRegion(($event.target as HTMLSelectElement).value):fit()"><option value="">Whole map</option><option v-for="region in regions" :key="region.id" :value="region.id">{{region.name}}</option></select></label><span v-if="editingRegions" class="sheet-small">Editing region borders</span><span v-else class="sheet-small">{{visibleCount}} of {{map.pins.length}} pins<span v-if="visibleCount<map.pins.length"> · Zoom in to reveal more</span></span><div class="map-actions"><button v-if="regions.length" type="button" class="sheet-button sheet-small-button" :aria-pressed="atlas" @click="atlas=!atlas">Region atlas</button><label v-if="editingRegions" class="map-show-all"><input v-model="showBorders" type="checkbox" />Show borders</label><label v-if="canManage" class="map-show-all"><input v-model="showAll" type="checkbox" :disabled="disabled" />Show all pins</label><button class="sheet-button sheet-small-button" type="button" aria-label="Zoom out" @click="zoomAt(.8)">−</button><span class="map-zoom">{{Math.round(zoom*100)}}%</span><button class="sheet-button sheet-small-button" type="button" aria-label="Zoom in" @click="zoomAt(1.25)">+</button><button class="sheet-button sheet-small-button" type="button" @click="fit()">Whole map</button></div></div>
    <div class="map-canvas-body" :data-atlas="!focused&&atlas&&regions.length>0">
      <aside v-show="!focused" v-if="atlas&&regions.length" class="map-region-atlas" aria-label="Region atlas">
        <button type="button" class="sheet-button sheet-small-button" :disabled="disabled||drawingRegion" :aria-pressed="!activeRegion" @click="fit()">Whole map</button>
        <button v-for="region in regions" :key="region.id" type="button" class="sheet-button map-atlas-region" :aria-pressed="activeRegion===region.id" :disabled="disabled||drawingRegion" @click="chooseRegion(region.id)"><svg v-if="region.points.length>=3" :viewBox="thumbnail(region)" aria-hidden="true"><image :href="imageUrl" :width="map.width" :height="map.height" /></svg><span><i :style="{background:region.color}" aria-hidden="true"></i>{{region.name}}</span><small>{{map.pins.filter(p=>inRegion(p,region)).length}} {{map.pins.filter(p=>inRegion(p,region)).length===1?'location':'locations'}}</small></button>
      </aside>
    <div ref="viewport" class="map-viewport" :class="{'map-placing':placing,'map-dragging':dragging}" tabindex="0" role="region" :aria-label="`${map.title} map. Use arrow keys to pan, plus and minus to zoom. Locations are also listed below.`" @wheel="wheel" @pointerdown.self="down($event)" @pointermove="move" @pointerup="up" @pointercancel="pointerCancelled" @lostpointercapture="captureLost" @keydown="keyboard">
      <div ref="plane" class="map-plane" :style="style" @pointerdown.self="down($event)">
        <img :src="imageUrl" :alt="map.title" draggable="false" @error="emit('imageError')" />
        <MapRegionLayer :regions="regions" :active="activeRegion??''" :editing="!!editingRegions" :drawing="!!drawingRegion" :placing="placing" :selected-point="selectedRegionPoint??-1" :show-borders="showBorders" :scale="scale" :width="map.width" :height="map.height" :zoom="zoom" :focus-zoom="focusZoom" :disabled="!!disabled" @select="chooseRegion" @down="regionDown" @vertex="vertexDown" @insert="(i,p)=>emit('insertRegionPoint',i,p)" @point-select="emit('selectRegionPoint',$event)" @remove="emit('removeRegionPoint')" />
        <TransitionGroup name="map-pin-visibility" @before-leave="pinLeaving" @before-enter="pinEntering" @leave-cancelled="pinEntering">
          <button v-for="pin in shownPins" :key="pin.id" class="map-pin" :class="{'map-pin-movable':canDrag(pin.id),'map-pin-moving':movingPin===pin.id,'map-pin-draft':isDraft(pin.id)}" :data-map-pin="pin.id" :data-pin-color="pin.display.color" type="button" draggable="false" :style="{left:`${pinPosition(pin.id,pin.x,pin.y).x*100}%`,top:`${pinPosition(pin.id,pin.x,pin.y).y*100}%`,transform:`translate(-50%,-100%) scale(${1/scale})`}" :aria-label="`${pin.label}${canDrag(pin.id)?'. Drag or use arrow keys to move.':''}${isDraft(pin.id)?' Unsaved position.':' Right-click for options.'}`" :aria-pressed="selectedPin===pin.id" :title="pin.label" @dragstart.prevent @pointerdown.stop="down($event,pin.id)" @click.stop="open(pin.id,$event)" @contextmenu="context($event,pin.id)" @keydown="pinKeys($event,pin.id)">
            <MapPinGlyph :symbol="pin.display.symbol" :number="pin.id===draftId?'+':pin.number" />
            <span v-if="!isDraft(pin.id)&&pin.display.label!=='never'&&(pin.display.label==='always'||selectedPin===pin.id)" class="map-pin-label" aria-hidden="true">{{pin.label}}</span>
          </button>
        </TransitionGroup>
      </div>
    </div>
    </div>
  </div>
</template>
