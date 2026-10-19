<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { featNameKey, featTerms } from '../../lib/feat-references'
import FeatureText from './FeatureText.vue'

const props = defineProps<{ name: string }>()
const library = useSheetLibrary()
const dialog = ref<HTMLDialogElement | null>(null), trigger = ref<HTMLButtonElement | null>(null)
const selected = ref(''), showing = ref(false)
const previewSuppressed = ref(false)
const previewOffset = ref(0), placement = ref('above')
const id = `feat-${crypto.randomUUID()}`
const versions = computed(() => {
  const wanted = featNameKey(props.name)
  const matches = library.featCatalog.value.filter(feat => [feat.name, feat.displayName ?? '', (feat.contentKey ?? '').replace(/^.*\//, '')].some(name => featNameKey(name) === wanted))
  const result: { id: string; name: string; description: string; sources: string[]; abilities:string[]; prerequisites:string[] }[] = []
  for (const feat of matches) {
    const text = feat.description.trim(), abilities=featTerms(feat.ability_increases), prerequisites=featTerms(feat.prerequisites)
    const same = result.find(entry => entry.description.replace(/\s+/g,' ') === text.replace(/\s+/g,' ') && JSON.stringify(entry.abilities)===JSON.stringify(abilities) && JSON.stringify(entry.prerequisites)===JSON.stringify(prerequisites))
    if (same) { if (feat.sourcePack && !same.sources.includes(feat.sourcePack)) same.sources.push(feat.sourcePack) }
    else result.push({ id: feat.index, name: feat.name, description: text, sources: feat.sourcePack ? [feat.sourcePack] : [], abilities, prerequisites })
  }
  if (!result.length) {
    const saved = library.features.value.filter(feat => featNameKey(feat.name) === wanted && !/^feats?$/i.test(feat.name) && feat.description.trim())
    for (const [index, feat] of saved.entries()) if (!result.some(entry => entry.description === feat.description)) result.push({ id: `saved-${index}`, name: feat.name, description: feat.description, sources: ['Saved character feature'], abilities:[], prerequisites:[] })
  }
  return result
})
const detail = computed(() => versions.value.find(entry => entry.id === selected.value))
watch(versions, entries => { if (showing.value && !entries.some(entry => entry.id === selected.value)) selected.value = entries.length === 1 ? entries[0]!.id : '' })
const preview = computed(() => versions.value.length === 1
  ? (versions.value[0]!.description.slice(0, 320) || 'This source did not supply a description.') + (versions.value[0]!.description.length > 320 ? '…' : '')
  : versions.value.length > 1 ? 'Several source versions match this name. Open the details to choose the version you want to read.'
    : library.loading.value ? 'Loading your feat library…' : 'No matching definition is available. The imported feat name is preserved.')
async function open() {
  previewSuppressed.value = true
  selected.value = versions.value.length === 1 ? versions.value[0]!.id : ''
  showing.value = true
  await nextTick()
  dialog.value?.showModal()
}
function closed() { previewSuppressed.value = true; showing.value = false; trigger.value?.focus({ preventScroll: true }) }
function previewEnter(event: MouseEvent) {
  if (!showing.value) previewSuppressed.value = false
  positionPreview(event)
}
function positionPreview(event:MouseEvent|FocusEvent) {
  const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(), width=Math.min(360,window.innerWidth-24)
  previewOffset.value=Math.min(Math.max(12,rect.left),window.innerWidth-width-12)-rect.left
  placement.value=rect.top>240?'above':'below'
}
</script>

<template>
  <span class="sheet-feat-reference" :data-placement="placement" :data-preview-suppressed="previewSuppressed || showing" :style="{'--feat-preview-offset':`${previewOffset}px`}" @mouseenter="previewEnter" @focusin="positionPreview" @focusout="previewSuppressed=false" @keydown.esc="previewSuppressed=true"><button ref="trigger" type="button" class="sheet-feat-link" aria-haspopup="dialog" :aria-describedby="`${id}-preview`" @click="open">{{name}} <span aria-hidden="true">ⓘ</span></button><span :id="`${id}-preview`" role="tooltip" class="sheet-feat-preview"><strong>{{name}}</strong><span>{{preview}}</span><small>Click or tap for full details</small></span></span>
  <Teleport to=".site-shell"><dialog v-if="showing" ref="dialog" class="sheet-feat-dialog" :aria-labelledby="`${id}-title`" @close="closed"><header><div><p class="sheet-eyebrow">FEAT REFERENCE</p><h2 :id="`${id}-title`">{{detail?.name??name}}</h2></div><button type="button" class="sheet-button" aria-label="Close feat details" @click="dialog?.close()">✕</button></header><div class="sheet-feat-dialog-body"><template v-if="versions.length"><label v-if="versions.length>1" class="sheet-feat-version">Source version<select v-model="selected" class="input-base"><option value="">Choose a matching source…</option><option v-for="version in versions" :key="version.id" :value="version.id">{{version.name}} · {{version.sources.join(', ')||'Imported source'}}</option></select></label><template v-if="detail"><p class="sheet-small">{{detail.sources.join(' · ')}}</p><dl v-if="detail.abilities.length||detail.prerequisites.length" class="sheet-feat-facts"><div v-if="detail.prerequisites.length"><dt>Prerequisites</dt><dd>{{detail.prerequisites.join(', ')}}</dd></div><div v-if="detail.abilities.length"><dt>Ability increase options</dt><dd>{{detail.abilities.join(', ')}}</dd></div></dl><FeatureText :text="detail.description||'This source did not supply a description.'" /></template><p v-else class="sheet-feature-text">Several versions share this feat name. Choose a source above to read its rules.</p></template><p v-else class="sheet-feature-text">{{library.loading.value?'The feat library is still loading. Close and open this reference again once it finishes.':'No matching feat definition was found in your current library. The imported name remains on your character; its rules can be recorded in Edit character.'}}</p></div><footer><button type="button" class="sheet-button" @click="dialog?.close()">Close</button></footer></dialog></Teleport>
</template>
