<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'
const c=computed(()=>useCharactersStore().current!)
</script>
<template>
  <header class="sheet-folio-header">
    <div class="sheet-folio-identity">
      <div class="sheet-folio-initial" aria-hidden="true"><img v-if="c.meta.portrait" :src="c.meta.portrait" alt="" /><span v-else>{{c.meta.name.charAt(0)}}</span></div>
      <div><h1>{{c.meta.name}}</h1><p>Level {{c.meta.level}} {{c.meta.klass}} · {{c.meta.race}}{{c.meta.subrace?` · ${c.meta.subrace}`:''}}<span v-if="c.meta.subclass"> · {{c.meta.subclass}}</span></p></div>
    </div>
  </header>
</template>
