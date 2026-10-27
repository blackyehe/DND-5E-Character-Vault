<script setup lang="ts">
import {nextTick, reactive, ref} from 'vue'
import type {NotebookQuestClue} from '../../../shared/notebook'
import {NOTEBOOK_CLUE_BODY_LIMIT, NOTEBOOK_CLUE_LIMIT} from '../../../shared/notebook-clues'
import NotebookEditor from './NotebookEditor.vue'
import type {NotebookLinkTarget} from '../../../shared/notebook-links'
const clues = defineModel<NotebookQuestClue[]>({required: true})
const props = defineProps<{disabled: boolean; targets: NotebookLinkTarget[]; loading?: boolean; linkError?: string; excludeId?: string}>()
defineEmits<{retry: []}>()
const editor = ref<HTMLElement | null>(null)
const sessionText = reactive<Record<string,string>>({})
async function focusClue(id?:string) {
  await nextTick()
  const fields=[...editor.value?.querySelectorAll<HTMLElement>('[data-clue-id]')??[]]
  const target=fields.find(field=>field.dataset.clueId===id)??fields[0]
  const input=target?.querySelector<HTMLInputElement>('input')
  const reader=editor.value?.closest<HTMLElement>('.notebook-reader')
  if(reader){const element=target??editor.value!;reader.scrollTop+=element.getBoundingClientRect().top-reader.getBoundingClientRect().top-24}
  input?.focus({preventScroll:true})
}
async function add() {
  if(props.disabled||clues.value.length>=NOTEBOOK_CLUE_LIMIT)return
  const id=crypto.randomUUID()
  clues.value = [...clues.value, {id, title: '', body: '', sessions: [], audience: 'dm'}]
  await focusClue(id)
}
defineExpose({add,focusClue})
function sessions(clue: NotebookQuestClue, event: Event) {
  const input = event.target as HTMLInputElement, value = input.value.trim()
  sessionText[clue.id] = input.value
  const numbers = value ? value.split(/[,\s]+/).map(Number) : []
  const valid = numbers.length <= 100 && numbers.every(n => Number.isInteger(n) && n > 0 && n <= 10000)
  input.setCustomValidity(valid ? '' : 'Enter session numbers from 1 to 10000, separated by commas.')
  if (valid) clue.sessions = [...new Set(numbers)].sort((a,b) => a-b)
}
</script>
<template>
  <section ref="editor" class="codex-clue-editor" aria-label="Quest clues">
    <div class="notebook-reader-heading"><h3>Clues</h3><button type="button" class="sheet-button sheet-small-button" :disabled="disabled||clues.length>=NOTEBOOK_CLUE_LIMIT" @click="add">Add clue</button></div>
    <p class="sheet-small">Record gathered clues and their session sources. Each clue stays DM only until you choose Whole room. Players also need access to the quest.</p>
    <fieldset v-for="(clue,index) in clues" :key="clue.id" :data-clue-id="clue.id" class="codex-clue-fields" :disabled="disabled">
      <legend>{{clue.title||'New clue'}}</legend>
      <label>Clue title<input v-model="clue.title" maxlength="120" required /></label>
      <NotebookEditor v-model="clue.body" :label="'Clue description '+(index+1)" :targets="targets" :disabled="disabled" :loading="loading" :link-error="linkError" :exclude-id="excludeId" :maxlength="NOTEBOOK_CLUE_BODY_LIMIT" :rows="3" @retry="$emit('retry')" />
      <div class="codex-clue-settings"><label>Session sources<input :value="sessionText[clue.id]??clue.sessions.join(', ')" placeholder="12, 13" @input="sessions(clue,$event)" /></label><label>Who can read this clue?<select v-model="clue.audience"><option value="dm">DM only</option><option value="room">Whole room</option></select></label></div>
      <button type="button" class="sheet-button sheet-small-button" :aria-label="'Remove clue '+(clue.title||index+1)" @click="clues=clues.filter(c=>c.id!==clue.id)">Remove clue</button>
    </fieldset>
    <p v-if="!clues.length" class="sheet-small">No clues recorded. Add one when there is evidence to track.</p>
    <p v-if="clues.length>=NOTEBOOK_CLUE_LIMIT" class="sheet-small">This quest has reached the {{NOTEBOOK_CLUE_LIMIT}} clue limit.</p>
  </section>
</template>
