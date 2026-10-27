<script setup lang="ts">
import {computed} from 'vue'
import {MAP_LIMITS,type MapRegion,type MapPoint} from '../../../shared/room-maps'
import {regionProblem} from '../../../shared/map-regions'
const regions=defineModel<MapRegion[]>({required:true})
const props=defineProps<{active:string;point:number;drawing:boolean;disabled:boolean}>()
const emit=defineEmits<{add:[];finish:[];save:[];cancel:[];selectPoint:[index:number];movePoint:[index:number,position:MapPoint];removePoint:[];removeRegion:[];undo:[]}>()
const current=computed(()=>regions.value.find(r=>r.id===props.active))
const issue=computed(()=>regions.value.map(r=>!r.name.trim()?'Give each region a name.':regionProblem(r.points)).find(Boolean)??'')
const position=computed(()=>current.value?.points[props.point])
function coordinate(axis:'x'|'y',event:Event){if(position.value)emit('movePoint',props.point,{...position.value,[axis]:Math.max(0,Math.min(1,Number((event.target as HTMLInputElement).value)/100))})}
</script>
<template>
  <section class="map-region-editor" aria-label="Edit map regions">
    <div class="map-region-edit-actions">
      <div class="map-actions"><button type="button" class="sheet-button sheet-small-button" :disabled="disabled||drawing||regions.length>=MAP_LIMITS.regionsPerMap" @click="emit('add')">Draw region</button><template v-if="drawing"><button type="button" class="sheet-button sheet-small-button" :disabled="disabled||!current?.points.length" @click="emit('undo')">Undo point</button><button type="button" class="sheet-button sheet-small-button" :disabled="disabled||!current||!!regionProblem(current.points)" @click="emit('finish')">Finish border</button></template><button v-if="current" type="button" class="sheet-button sheet-small-button" :disabled="disabled" @click="emit('removeRegion')">Delete region</button></div>
      <div class="map-actions"><button type="button" class="sheet-button sheet-small-button" :disabled="disabled" @click="emit('cancel')">Cancel</button><button type="button" class="sheet-button sheet-button-primary sheet-small-button" :disabled="disabled||drawing||!!issue" @click="emit('save')">{{disabled?'Saving…':'Save borders'}}</button></div>
    </div>
    <div class="map-region-fields" v-if="current">
      <label>Region name<input v-model="current.name" maxlength="120" :disabled="disabled" /></label>
      <label class="map-region-color">Colour<input v-model="current.color" type="color" :disabled="disabled" /></label>
      <label>Overlay {{Math.round(current.opacity*100)}}%<input v-model.number="current.opacity" type="range" min=".05" max=".6" step=".01" :disabled="disabled" /></label>
      <label>Fade when zooming closer<select v-model.number="current.fadeZoom" :disabled="disabled"><option :value="1.5">A little closer</option><option :value="1.8">Moderately closer</option><option :value="2.5">Much closer</option></select></label>
    </div>
    <div v-if="current&&!drawing" class="map-region-point-controls">
      <label>Point<select :value="point" :disabled="disabled" @change="emit('selectPoint',Number(($event.target as HTMLSelectElement).value))"><option :value="-1">Select a point</option><option v-for="(_,i) in current.points" :key="i" :value="i">{{i+1}}</option></select></label>
      <template v-if="position"><label>Across (%)<input type="number" min="0" max="100" step=".01" :value="Math.round(position.x*10000)/100" :disabled="disabled" @input="coordinate('x',$event)" /></label><label>Down (%)<input type="number" min="0" max="100" step=".01" :value="Math.round(position.y*10000)/100" :disabled="disabled" @input="coordinate('y',$event)" /></label><button type="button" class="sheet-button sheet-small-button" :disabled="disabled||current.points.length<=3" @click="emit('removePoint')">Remove point</button></template>
      <span class="sheet-small">{{current.points.length}} / {{MAP_LIMITS.pointsPerRegion}} points</span>
    </div>
    <p class="sheet-small" role="status">{{drawing?'Click around the border, then Finish border. You can pan and zoom while drawing.':current?'Drag points to refine the shape. Select a + between points to add one; select a point to remove it or use arrow keys. Pins inside the border belong to this region.':'Draw a region to begin. Its name and colour are visible to everyone who can open this map.'}} <span v-if="issue">{{issue}}</span></p>
  </section>
</template>
