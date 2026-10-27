<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import type { CharacterSummary } from '../../../shared/character'
import { folderTrail, folderLabel, type CharacterLibrary, type LibraryAction } from '../../../shared/character-library'
import './character-folders.css'
const props = defineProps<{ library: CharacterLibrary; characters: CharacterSummary[]; current: string; layout: 'tree' | 'shelf'; disabled: boolean; dragging: boolean }>()
const emit = defineEmits<{ navigate: [id: string]; change: [action: LibraryAction]; dropCharacters: [folderId: string | null] }>()
const collapsed = ref(new Set<string>()), editor = ref<'create' | 'rename' | 'reparent' | 'remove' | ''>(''), name = ref(''), parent = ref(''), nameInput = ref<HTMLInputElement | null>(null), dialog = ref<HTMLDialogElement | null>(null), hover = ref(''), returnFocus = ref<HTMLElement | null>(null), error = ref('')
const titleId = useId(), active = computed(() => props.library.folders.find(f => f.id === props.current)), trail = computed(() => folderTrail(props.library.folders, active.value?.id ?? null))
const counts = computed(() => { const placement = new Map(props.library.placements.map(p => [p.characterId, p.folderId])), result = new Map<string | null, number>(); for (const c of props.characters) { const id = placement.get(c._id) ?? null; result.set(id, (result.get(id) ?? 0) + 1) } return result })
const count = (id: string | null) => counts.value.get(id) ?? 0
const rows = computed(() => {
 const rows: { id: string; name: string; depth: number; children: boolean }[] = []
 function add(parentId: string | null, depth: number) { for (const f of props.library.folders.filter(f => f.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name))) { rows.push({ ...f, depth, children: props.library.folders.some(child => child.parentId === f.id) }); if (!collapsed.value.has(f.id)) add(f.id, depth + 1) } }
 add(null, 0); return rows
})
const children = computed(() => props.library.folders.filter(f => f.parentId === (active.value?.id ?? null)).sort((a,b) => a.name.localeCompare(b.name)))
const destinations = computed(() => props.library.folders.filter(f => !active.value || !folderTrail(props.library.folders, f.id).some(p => p.id === active.value!.id)).map(f => ({ id: f.id, label: folderLabel(props.library.folders, f.id) })).sort((a,b) => a.label.localeCompare(b.label)))
function toggle(id: string) { const next = new Set(collapsed.value); next.has(id) ? next.delete(id) : next.add(id); collapsed.value = next }
async function open(mode: typeof editor.value) { returnFocus.value = document.activeElement as HTMLElement; editor.value = mode; name.value = mode === 'rename' ? active.value?.name ?? '' : ''; parent.value = mode === 'create' ? active.value?.id ?? '' : active.value?.parentId ?? ''; error.value = ''; await nextTick(); dialog.value?.showModal(); nameInput.value?.focus() }
function close() { dialog.value?.close(); editor.value = ''; returnFocus.value?.focus({ preventScroll: true }) }
function submit() {
 if (props.disabled) return
 const folder = active.value
 if ((editor.value === 'create' || editor.value === 'rename') && !name.value.trim()) { error.value = 'Give this folder a name.'; return }
 if (editor.value === 'create') emit('change', { type: 'create', name: name.value.trim(), parentId: parent.value || null })
 else if (folder && editor.value === 'rename') emit('change', { type: 'rename', folderId: folder.id, name: name.value.trim() })
 else if (folder && editor.value === 'reparent') emit('change', { type: 'reparent', folderId: folder.id, parentId: parent.value || null })
 else if (folder && editor.value === 'remove') emit('change', { type: 'remove', folderId: folder.id })
 close()
}
function over(event: DragEvent, id: string) { if (!props.dragging || props.disabled || !event.dataTransfer?.types.includes('application/x-codex-character')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; hover.value = id }
function drop(event: DragEvent, id: string | null) { if (!props.dragging || props.disabled) return; event.preventDefault(); hover.value = ''; emit('dropCharacters', id) }
</script>
<template>
 <section class="character-folders" :class="`folders-${layout}`" aria-label="Character folders">
  <div class="folder-heading"><h2>Folders</h2><button type="button" class="btn-ghost" :disabled="disabled" @click="open('create')">New folder</button></div>
  <nav v-if="layout==='tree'" aria-label="Character folders">
   <button type="button" class="folder-row" :aria-current="current==='all'?'page':undefined" @click="emit('navigate','all')"><span class="folder-symbol" aria-hidden="true">▤</span><span>All characters</span><small>{{ characters.length }}</small></button>
   <button type="button" class="folder-row" :class="{'folder-drop':hover==='unfiled'}" :aria-current="current==='unfiled'?'page':undefined" @click="emit('navigate','unfiled')" @dragover="over($event,'unfiled')" @dragleave="hover=''" @drop="drop($event,null)"><span class="folder-symbol" aria-hidden="true">▱</span><span>Unfiled</span><small>{{ count(null) }}</small></button>
   <div v-for="row in rows" :key="row.id" class="folder-tree-row" :style="{'--folder-depth':row.depth}">
    <button v-if="row.children" type="button" class="folder-branch" :aria-label="`${collapsed.has(row.id)?'Expand':'Collapse'} ${row.name}`" :aria-expanded="!collapsed.has(row.id)" @click="toggle(row.id)">{{ collapsed.has(row.id)?'›':'⌄' }}</button><span v-else class="folder-branch-space" />
    <button type="button" class="folder-row" :class="{'folder-drop':hover===row.id}" :aria-current="current===row.id?'page':undefined" :title="folderLabel(library.folders,row.id)" @click="emit('navigate',row.id)" @dragover="over($event,row.id)" @dragleave="hover=''" @drop="drop($event,row.id)"><svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 3h9v11H3z" /></svg><span>{{ row.name }}</span><small>{{ count(row.id) }}</small></button>
   </div>
  </nav>
  <template v-else>
   <nav class="folder-breadcrumbs" aria-label="Folder path"><button type="button" :aria-current="current==='all'?'page':undefined" @click="emit('navigate','all')">All characters</button><template v-for="folder in trail" :key="folder.id"><span aria-hidden="true">/</span><button type="button" :aria-current="current===folder.id?'page':undefined" @click="emit('navigate',folder.id)">{{ folder.name }}</button></template><template v-if="current==='unfiled'"><span aria-hidden="true">/</span><span>Unfiled</span></template></nav>
   <nav class="folder-shelf" aria-label="Character folders"><button v-if="!active" type="button" class="folder-row" :class="{'folder-drop':hover==='unfiled'}" @click="emit('navigate','unfiled')" @dragover="over($event,'unfiled')" @dragleave="hover=''" @drop="drop($event,null)"><span class="folder-symbol" aria-hidden="true">▱</span><span>Unfiled</span><small>{{ count(null) }}</small></button><button v-for="folder in children" :key="folder.id" type="button" class="folder-row" :class="{'folder-drop':hover===folder.id}" @click="emit('navigate',folder.id)" @dragover="over($event,folder.id)" @dragleave="hover=''" @drop="drop($event,folder.id)"><svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7l2 3h9v11H3z" /></svg><span>{{ folder.name }}</span><small>{{ count(folder.id) }}</small></button></nav>
  </template>
  <p v-if="!library.folders.length" class="folder-help">Start with a campaign folder, then add Main Characters, NPCs, or your own groups.</p>
  <div v-if="active" class="folder-tools"><span :title="folderLabel(library.folders,active.id)">{{ active.name }}</span><button type="button" class="btn-ghost" :disabled="disabled" @click="open('rename')">Rename</button><button type="button" class="btn-ghost" :disabled="disabled" @click="open('reparent')">Move folder</button><button type="button" class="btn-ghost" :disabled="disabled||library.folders.some(f=>f.parentId===active!.id)" :title="library.folders.some(f=>f.parentId===active!.id)?'Move or remove subfolders first':undefined" @click="open('remove')">Remove</button></div>
  <p v-if="dragging" class="folder-help" role="status">Drop onto a folder or Unfiled to move.</p>
  <dialog ref="dialog" class="folder-dialog" :aria-labelledby="titleId" @cancel.prevent="close" @click="($event.target===dialog)&&close()">
   <form @submit.prevent="submit"><h2 :id="titleId">{{ editor==='create'?'New folder':editor==='rename'?'Rename folder':editor==='reparent'?'Move folder':'Remove folder' }}</h2>
    <label v-if="editor==='create'||editor==='rename'">Folder name<input ref="nameInput" v-model="name" maxlength="80" required /></label>
    <label v-if="editor==='create'||editor==='reparent'">{{ editor==='create'?'Create inside':'Move into' }}<select v-model="parent"><option value="">Library root</option><option v-for="folder in editor==='create'?library.folders.map(f=>({id:f.id,label:folderLabel(library.folders,f.id)})):destinations" :key="folder.id" :value="folder.id">{{ folder.label }}</option></select></label>
    <p v-if="editor==='remove'">Remove “{{ active?.name }}”? Its characters will move to {{ active?.parentId?folderLabel(library.folders,active.parentId):'Unfiled' }}. Character sheets are kept.</p><p v-if="error" role="alert">{{ error }}</p>
    <div class="folder-dialog-actions"><button type="button" class="btn-ghost" @click="close">Cancel</button><button type="submit" class="btn-primary" :disabled="disabled">{{ editor==='create'?'Create folder':editor==='remove'?'Remove folder':'Save folder' }}</button></div>
   </form>
  </dialog>
 </section>
</template>
