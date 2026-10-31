<script setup lang="ts">
defineProps<{title:string;description:string}>()
</script>

<template>
  <div class="hw-library-tools">
    <div class="hw-library-toolbar">
      <div class="hw-library-search"><slot name="search" /></div>
      <div v-if="$slots.actions" class="hw-actions hw-library-create"><slot name="actions" /></div>
      <div v-if="$slots.filters" class="hw-actions hw-library-types"><slot name="filters" /></div>
    </div>
    <header class="hw-library-heading">
      <div><h2>{{title}}</h2><p class="hw-hint">{{description}}</p></div>
      <div v-if="$slots.utility" class="hw-actions"><slot name="utility" /></div>
    </header>
  </div>
</template>
