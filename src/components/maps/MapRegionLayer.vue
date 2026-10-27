<script setup lang="ts">
import {computed} from 'vue'
import {MAP_LIMITS,type MapRegion,type MapPoint} from '../../../shared/room-maps'
import {regionLabelPoint} from '../../../shared/map-regions'
const props=defineProps<{regions:MapRegion[];active:string;editing:boolean;drawing:boolean;placing?:boolean;selectedPoint:number;showBorders:boolean;scale:number;width:number;height:number;zoom:number;focusZoom:(region:MapRegion)=>number;disabled:boolean}>()
const emit=defineEmits<{select:[id:string];down:[event:PointerEvent,regionId:string];vertex:[event:PointerEvent,index:number];insert:[index:number,point:MapPoint];pointSelect:[index:number];remove:[]}>()
const current=computed(()=>props.regions.find(r=>r.id===props.active))
function opacity(region:MapRegion){if(props.editing)return props.showBorders?1:0;const end=Math.min(10,props.focusZoom(region)*region.fadeZoom),start=Math.min(end-.1,props.focusZoom(region)*1.12);return Math.max(0,Math.min(1,(end-props.zoom)/(end-start)))}
const labelPosition=(region:MapRegion)=>{const p=regionLabelPoint(region);return {left:`${p.x*100}%`,top:`${p.y*100}%`}}
const position=(p:MapPoint)=>({left:`${p.x*100}%`,top:`${p.y*100}%`,transform:`translate(-50%,-50%) scale(${1/props.scale})`})
function midpoint(a:MapPoint,b:MapPoint):MapPoint{return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
function insert(event:PointerEvent,index:number){if(props.disabled||!current.value)return;emit('insert',index,midpoint(current.value.points[index]!,current.value.points[(index+1)%current.value.points.length]!));emit('vertex',event,index+1)}
function keys(event:KeyboardEvent,index:number){if(props.disabled||!current.value)return;emit('pointSelect',index);if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();emit('remove')}}
</script>
<template>
  <div class="map-region-layer">
    <svg :viewBox="`0 0 ${width} ${height}`" class="map-region-polygons" aria-hidden="true">
      <template v-for="region in regions" :key="region.id"><polygon v-if="region.points.length>=3" :data-map-region="region.id" :points="region.points.map(p=>`${p.x*width},${p.y*height}`).join(' ')" :fill="region.color" :fill-opacity="region.opacity" :stroke="region.color" :stroke-width="(active===region.id?2:1.4)/scale" :style="{opacity:opacity(region),pointerEvents:!placing&&!editing&&!disabled&&opacity(region)>.12?'fill':'none'}" @pointerdown.stop="emit('down',$event,region.id)" /><polyline v-else-if="region.points.length" :points="region.points.map(p=>`${p.x*width},${p.y*height}`).join(' ')" fill="none" :stroke="region.color" :stroke-width="2/scale" /></template>
    </svg>
    <template v-for="region in regions" :key="region.id"><button v-if="region.points.length>=3&&opacity(region)>.08&&(!editing||active!==region.id)" type="button" class="map-region-name" :disabled="disabled||drawing" :style="{...labelPosition(region),transform:`translate(-50%,-50%) scale(${1/scale})`,opacity:opacity(region),pointerEvents:placing?'none':undefined,'--region-color':region.color}" @pointerdown.stop @click="emit('select',region.id)">{{region.name}}</button></template>
    <template v-if="editing&&current">
      <template v-for="(p,i) in current.points" :key="i">
        <button type="button" class="map-region-vertex" :class="{'is-selected':selectedPoint===i}" :data-region-point="i" :aria-label="`Border point ${i+1}. Drag or use arrow keys to move. Delete to remove.`" :aria-pressed="selectedPoint===i" :style="position(p)" :disabled="disabled" @pointerdown.stop.prevent="emit('vertex',$event,i)" @focus="emit('pointSelect',i)" @click.stop="emit('pointSelect',i)" @keydown="keys($event,i)">{{i+1}}</button>
        <button v-if="!drawing&&current.points.length<MAP_LIMITS.pointsPerRegion" type="button" class="map-region-midpoint" :aria-label="`Insert border point after point ${i+1}`" :style="position(midpoint(p,current.points[(i+1)%current.points.length]!))" :disabled="disabled" @pointerdown.stop.prevent="insert($event,i)" @click="($event.detail===0)&&emit('insert',i,midpoint(p,current.points[(i+1)%current.points.length]!))">+</button>
      </template>
    </template>
  </div>
</template>
