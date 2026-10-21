<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { compendiumGroups, type CompendiumTab } from '../../lib/compendium-navigation'
import './compendium-categories.css'

defineProps<{ modelValue: CompendiumTab }>()
const emit = defineEmits<{ 'update:modelValue': [value: CompendiumTab] }>()
const root = ref<HTMLElement | null>(null)
function closeFolders() { root.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(folder => { folder.open = false }) }
function choose(value: CompendiumTab, folder?: HTMLDetailsElement | null) {
  emit('update:modelValue', value)
  closeFolders()
  folder?.querySelector('summary')?.focus({ preventScroll: true })
}
function outside(event: PointerEvent) { if (event.target instanceof Node && !root.value?.contains(event.target)) closeFolders() }
function focusOutside(event: FocusEvent) { if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) closeFolders() }
function escape(event: KeyboardEvent) {
  const folder = root.value?.querySelector<HTMLDetailsElement>('details[open]')
  if (!folder) return
  event.preventDefault(); closeFolders(); folder.querySelector('summary')?.focus({ preventScroll: true })
}
function openFolder(event: Event) {
  const folder = event.target as HTMLDetailsElement
  if (folder.open) root.value?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(other => { if (other !== folder) other.open = false })
}
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <nav ref="root" class="compendium-categories" aria-label="Compendium categories" @keydown.esc="escape" @focusout="focusOutside">
    <div class="compendium-category-row">
      <template v-for="group in compendiumGroups" :key="group.label">
        <button v-if="group.entries.length === 1" type="button" class="btn-ghost" :aria-current="group.entries[0].value === modelValue ? 'page' : undefined" @click="choose(group.entries[0].value)">{{ group.label }}</button>
        <details v-else class="compendium-category-folder" :data-active="group.entries.some(entry => entry.value === modelValue)" @toggle="openFolder">
          <summary>{{ group.label }} <span aria-hidden="true">▾</span></summary>
          <div class="compendium-category-options">
            <button v-for="entry in group.entries" :key="entry.value" type="button" :aria-current="entry.value === modelValue ? 'page' : undefined" @click="choose(entry.value, ($event.currentTarget as HTMLElement).closest('details'))">{{ entry.label }}</button>
          </div>
        </details>
      </template>
    </div>
    <label class="compendium-category-select">Browse category
      <select :value="modelValue" @change="choose(($event.target as HTMLSelectElement).value as CompendiumTab)">
        <optgroup v-for="group in compendiumGroups" :key="group.label" :label="group.label"><option v-for="entry in group.entries" :key="entry.value" :value="entry.value">{{ entry.label }}</option></optgroup>
      </select>
    </label>
  </nav>
</template>
