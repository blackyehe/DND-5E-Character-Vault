<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { CharacterFeature } from '../../../shared/character'
import type { HomebrewFeat } from '../../lib/srd'
import { featVersions } from '../../lib/feat-references'
import FeatRules from './FeatRules.vue'

const props = defineProps<{ name: string; catalog: HomebrewFeat[]; features: CharacterFeature[]; loading?: boolean }>()
const dialog = ref<HTMLDialogElement | null>(null), trigger = ref<HTMLButtonElement | null>(null)
const showing = ref(false), hovered = ref(false), suppressed = ref(false)
const left = ref(12), top = ref(12), above = ref(false)
const id = `feat-${crypto.randomUUID()}`
const versions = computed(() => featVersions(props.name, props.catalog, props.features))
const previewText = computed(() => versions.value.length === 1
  ? (versions.value[0]!.description.slice(0, 320) || 'This source did not supply a description.') + (versions.value[0]!.description.length > 320 ? '…' : '')
  : versions.value.length > 1 ? 'Several source versions match this name. Open the details to choose a version.'
    : props.loading ? 'Loading feat rules…' : 'No matching definition is available. The imported feat name is preserved.')
function preview(event: MouseEvent | FocusEvent) {
  if (showing.value || suppressed.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(), width = Math.min(360, window.innerWidth - 24)
  left.value = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  above.value = rect.top > 270; top.value = above.value ? rect.top - 8 : rect.bottom + 8; hovered.value = true
}
function hide() { hovered.value = false }
function leave() { hide(); suppressed.value = false }
function open() {
  if (!dialog.value || dialog.value.open) return
  hide(); suppressed.value = true; showing.value = true
  dialog.value.showModal()
}
function closed() {
  // A native close event is queued: the user may already have reopened it.
  if (dialog.value?.open) return
  showing.value = false; hide(); suppressed.value = true; trigger.value?.focus({ preventScroll: true })
}
onMounted(() => { window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide) })
onUnmounted(() => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide) })
</script>

<template>
  <span class="sheet-feat-reference" @mouseenter="preview" @mouseleave="leave" @focusin="preview" @focusout="leave" @keydown.esc="hide"><button ref="trigger" type="button" class="sheet-feat-link" aria-haspopup="dialog" :aria-describedby="hovered && !showing ? `${id}-preview` : undefined" @click="open">{{name}} <span aria-hidden="true">ⓘ</span></button></span>
  <Teleport to=".site-shell">
    <span v-if="hovered && !showing" :id="`${id}-preview`" role="tooltip" class="sheet-feat-preview" :style="{left:`${left}px`,top:`${top}px`,transform:above?'translateY(-100%)':undefined}"><strong>{{name}}</strong><span>{{previewText}}</span><small>Click or tap for full details</small></span>
    <dialog ref="dialog" class="sheet-feat-dialog" :aria-labelledby="`${id}-title`" @close="closed"><header><h2 :id="`${id}-title`">{{name}}</h2><button type="button" class="sheet-button" aria-label="Close feat details" @click="dialog?.close()">✕</button></header><div class="sheet-feat-dialog-body"><FeatRules v-if="showing" :name="name" :catalog="catalog" :features="features" :loading="loading" /></div><footer><button type="button" class="sheet-button" @click="dialog?.close()">Close</button></footer></dialog>
  </Teleport>
</template>
