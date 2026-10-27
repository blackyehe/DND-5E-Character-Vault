<script setup lang="ts">
import type {MapPinDisplay} from '../../../shared/room-maps'
import MapPinGlyph from './MapPinGlyph.vue'
const display = defineModel<MapPinDisplay>({required: true})
defineProps<{disabled?: boolean}>()
const symbols = {number:'Number',settlement:'Settlement',fortress:'Fortress',ruins:'Ruins',quest:'Quest',danger:'Danger',person:'Person',treasure:'Treasure'}
const colors = {theme:'Site accent',gold:'Gold',blue:'Blue',green:'Green',purple:'Purple',red:'Red'}
</script>
<template>
  <div class="map-pin-display">
    <div class="map-pin-display-fields">
      <label>Show pin from<select v-model="display.visibility" aria-label="Show pin from" :disabled="disabled"><option value="always">Always visible</option><option value="zoomed">Zoomed in · 200%</option><option value="close">Close-up · 400%</option></select></label>
      <label>Show name<select v-model="display.label" aria-label="Show name" :disabled="disabled"><option value="selected">When selected</option><option value="always">With the pin</option><option value="never">On hover only</option></select></label>
    </div>
    <p class="sheet-small">Zoom is measured from Fit map (100%). This pin stays visible while you edit it.</p>
    <details class="map-pin-appearance">
      <summary><span class="map-pin-sample" :data-pin-color="display.color"><MapPinGlyph :symbol="display.symbol" /></span> Colour &amp; symbol</summary>
      <div class="map-pin-display-fields">
        <label>Pin colour<select v-model="display.color" aria-label="Pin colour" :disabled="disabled"><option v-for="(label,value) in colors" :key="value" :value="value">{{label}}</option></select></label>
        <label>Pin symbol<select v-model="display.symbol" aria-label="Pin symbol" :disabled="disabled"><option v-for="(label,value) in symbols" :key="value" :value="value">{{label}}</option></select></label>
      </div>
    </details>
  </div>
</template>
