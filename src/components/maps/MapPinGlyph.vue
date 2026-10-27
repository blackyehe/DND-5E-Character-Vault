<script setup lang="ts">
import type {MapPinDisplay} from '../../../shared/room-maps'
defineProps<{symbol: MapPinDisplay['symbol']; number?: number | string}>()
const paths: Record<string,string> = {
  settlement: 'm3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7',
  fortress: 'M4 21V4h4v4h3V4h3v4h3V4h3v17ZM10 21v-6h4v6',
  ruins: 'M3 21h18M5 18V8m5 10V8m4 10V8m5 10V8M3 5l9-3 9 3v3H3Z',
  quest: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
  danger: 'm12 3 10 18H2ZM12 9v5m0 3v1',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3',
  treasure: 'M3 9h18v12H3ZM3 9V5h18v4M10 9v6h4V9M3 12h7m4 0h7',
}
</script>
<template>
  <span v-if="symbol==='number'" aria-hidden="true">{{number ?? 1}}</span>
  <svg v-else class="map-pin-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[symbol]" /></svg>
</template>
