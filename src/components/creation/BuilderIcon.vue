<script setup lang="ts">
withDefaults(defineProps<{ name?: string; size?: number }>(), { name: 'star', size: 20 })
const paths: Record<string, string> = {
  leaf: 'M20 4C10 2 3 7 5 15c2 8 15 5 15-11ZM5 21 16 9M9 16l-1-5m4 2 5 1',
  swords: 'm4 3 13 13m-3 3 5-5M3 4l1 5 11 11 5-5L9 4 3 3Zm17 0-1 5-5 5m-4 4-5 3-2-2 3-5',
  dice: 'm12 2 9 5v10l-9 5-9-5V7l9-5Zm0 0v7m-9-2 9 2 9-2M3 17l9-8 9 8m-9-8v13',
  book: 'M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15M5 8h4m-4 4h4m6-4h4m-4 4h4',
  star: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
  wand: 'm4 20 12-12 4 4L8 24M14 10l4 4M5 3v4m-2-2h4m12-4v4m-2-2h4m0 14v4m-2-2h4',
  bag: 'M8 7V5a4 4 0 0 1 8 0v2M6 7h12l2 14H4L6 7Zm3 6h6m-5 4h4',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3',
  check: 'm5 12 4 4L19 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 7 7',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm0 4v12M7 8l5 2 5-2',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-7h10v7',
}
</script>

<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] ?? paths.star" /></svg></template>
