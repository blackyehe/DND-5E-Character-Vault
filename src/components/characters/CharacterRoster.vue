<script setup lang="ts">
import { computed, useId } from 'vue'
import type { CharacterSummary } from '../../../shared/character'
import './character-workspace.css'
const props = defineProps<{ characters: (CharacterSummary & { assignmentLabel?: string })[]; selectedId: string; collapsed: boolean; disabled?: boolean; query: string; organize?: boolean; allowDrag?: boolean; checked?: string[] }>()
const emit = defineEmits<{ select: [id: string]; toggle: []; 'update:query': [value: string]; check: [id: string]; dragCharacter: [id: string, event: DragEvent]; dragEnd: [] }>()
const listId = useId()
const matches = computed(() => props.collapsed ? props.characters : props.characters.filter(c => `${c.meta.name} ${c.meta.race} ${c.meta.klass} ${c.assignmentLabel ?? ''}`.toLowerCase().includes(props.query.trim().toLowerCase())))
const description = (c: typeof props.characters[number]) => `${c.meta.name || 'Unnamed'}, level ${c.meta.level} ${c.meta.klass}${c.assignmentLabel ? `, ${c.assignmentLabel}` : ''}`
</script>
<template>
  <aside class="character-roster" aria-label="Character library">
    <header class="character-roster-heading"><h2>Characters <small>{{ characters.length }}</small></h2><button type="button" class="btn-ghost character-roster-toggle" :aria-expanded="!collapsed" :aria-controls="listId" :aria-label="collapsed ? 'Expand character list' : 'Collapse character list'" @click="emit('toggle')"><span aria-hidden="true">{{ collapsed ? '›' : '‹' }}</span><span>{{ collapsed ? 'Show' : 'Hide' }}</span></button></header>
    <slot name="folders" />
    <label class="character-roster-search">Find a character<input :value="query" type="search" placeholder="Name or class…" @input="emit('update:query', ($event.target as HTMLInputElement).value)" /></label>
    <nav :id="listId" class="character-roster-list" aria-label="Your characters">
      <div v-for="character in matches" :key="character._id" class="character-roster-row">
      <label v-if="organize&&!collapsed" class="character-move-check"><input type="checkbox" :checked="checked?.includes(character._id)" :disabled="disabled" :aria-label="`Select ${character.meta.name||'Unnamed'} to move`" @change="emit('check',character._id)" /></label>
      <button type="button" class="character-roster-entry" :data-character-id="character._id" :draggable="(organize||allowDrag)&&!disabled" :disabled="disabled" :aria-current="selectedId === character._id ? 'true' : undefined" :aria-label="description(character)" :title="collapsed ? description(character) : allowDrag ? 'Drag to a folder, or select to open the sheet' : undefined" @click="emit('select', character._id)" @dragstart="emit('dragCharacter',character._id,$event)" @dragend="emit('dragEnd')">
        <span class="character-roster-initial" aria-hidden="true"><img v-if="character.meta.portrait" :src="character.meta.portrait" alt="" /><span v-else>{{ character.meta.name?.[0] || '?' }}</span></span>
        <span class="character-roster-copy"><strong>{{ character.meta.name || 'Unnamed' }}</strong><small>Level {{ character.meta.level }} · {{ character.meta.klass }}</small><small v-if="character.companionKind === 'shadow-champion'">Shadow Champion</small><small v-if="character.assignmentLabel">{{ character.assignmentLabel }}</small></span>
      </button>
      </div>
      <div v-if="!matches.length" class="character-roster-empty"><slot name="empty"><p>No matching characters.</p><button v-if="query" type="button" class="btn-ghost" @click="emit('update:query', '')">Clear search</button></slot></div>
    </nav>
  </aside>
</template>
