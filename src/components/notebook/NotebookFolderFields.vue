<script setup lang="ts">
import type {NotebookFolderDraft} from '../../../shared/notebook'
const model = defineModel<NotebookFolderDraft>({required:true})
defineProps<{parents:{id:string;path:string}[];disabled:boolean}>()
</script>
<template>
  <label>Folder name<input v-model="model.title" required maxlength="120" :disabled="disabled" /></label>
  <label>Parent folder<select v-model="model.parentId" :disabled="disabled"><option :value="null">Top level</option><option v-for="parent in parents" :key="parent.id" :value="parent.id">{{parent.path}}</option></select></label>
  <p class="sheet-small">Folders are shared with the whole room. Each entry keeps its own visibility settings.</p>
</template>
