<script setup lang="ts">
import type {NotebookQuestClue} from '../../../shared/notebook'
import {NOTEBOOK_CLUE_LIMIT} from '../../../shared/notebook-clues'
import NotebookText from './NotebookText.vue'
defineProps<{clues: NotebookQuestClue[]; dm: boolean; disabled: boolean; links: {id:string; title:string}[]; questHidden?:boolean}>()
defineEmits<{toggle: [id: string]; open: [id: string]; add: []; edit: [id:string]}>()
</script>
<template>
  <section class="codex-clues" aria-label="Gathered clues">
    <div class="notebook-reader-heading"><h3>Gathered clues</h3><small class="sheet-small">{{clues.length}} {{clues.length===1?'clue':'clues'}}</small></div>
    <div v-if="dm" class="codex-tab-actions"><button class="sheet-button sheet-small-button" :disabled="disabled||clues.length>=NOTEBOOK_CLUE_LIMIT" @click="$emit('add')">Add clue</button><span class="sheet-small">{{questHidden?'This quest is hidden. Its clues stay hidden until you show the quest to players.':'Only Whole room clues are visible to players.'}}</span></div>
    <p v-if="!clues.length" class="sheet-small">{{dm?'No clues recorded. Add gathered evidence here.':'No clues shared yet.'}}</p>
    <article v-for="clue in clues" :key="clue.id" class="codex-clue">
      <div class="notebook-reader-heading"><h4>{{clue.title}}</h4><span v-if="dm" class="codex-clue-audience" :data-audience="clue.audience">{{clue.audience==='room'?'Whole room':'DM only'}}</span></div>
      <p class="sheet-small codex-clue-sources">{{clue.sessions.length?clue.sessions.map(n=>n+'. session').join(' · '):'Session unconfirmed'}}</p>
      <NotebookText v-if="clue.body" :body="clue.body" :links="links" @open="$emit('open',$event)" />
      <div v-if="dm" class="notebook-actions"><button class="sheet-button sheet-small-button" :disabled="disabled" :aria-label="'Edit clue: '+clue.title" @click="$emit('edit',clue.id)">Edit clue</button><button class="sheet-button sheet-small-button" :disabled="disabled" :aria-label="(clue.audience==='room'?'Hide clue from players: ':'Show clue to players: ')+clue.title" @click="$emit('toggle',clue.id)">{{clue.audience==='room'?'Hide from players':'Show to players'}}</button></div>
    </article>
  </section>
</template>
