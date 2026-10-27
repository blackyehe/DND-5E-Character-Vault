<script setup lang="ts">
import {computed} from 'vue'
import type {NotebookEntry, NotebookEntryType} from '../../../shared/notebook'

const props = defineProps<{connections: NotebookEntry['connections']; emptyText?: string}>()
defineEmits<{open: [id: string]}>()
const kinds: {id: NotebookEntryType; label: string}[] = [
  {id: 'places', label: 'Connected places'},
  {id: 'people', label: 'Connected NPCs'},
  {id: 'factions', label: 'Connected groups'},
  {id: 'objects', label: 'Clues & discoveries'},
  {id: 'quests', label: 'Related quests'},
  {id: 'events', label: 'Related events'},
  {id: 'sessions', label: 'Related sessions'},
]
const groups = computed(() => kinds.map(kind => ({...kind,
  entries: props.connections.filter(entry => entry.codexType === kind.id)
    .slice().sort((a,b) => a.title.localeCompare(b.title, 'hu', {numeric: true})),
})).filter(group => group.entries.length))
</script>

<template>
  <section v-for="group in groups" :key="group.id" class="codex-connections" :aria-label="group.label">
    <h3>{{group.label}}</h3>
    <div class="codex-linked-list">
      <button v-for="entry in group.entries" :key="entry.id" class="sheet-button" @click="$emit('open', entry.id)">
        {{entry.title}}<span aria-hidden="true">→</span>
      </button>
    </div>
  </section>
  <p v-if="!connections.length && emptyText" class="sheet-small">{{emptyText}}</p>
</template>
