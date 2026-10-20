<script setup lang="ts">
import { useBuilderAppearance, type BuilderTheme, type BuilderAccent } from '../../composables/useBuilderAppearance'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()
const { appearance, resetAppearance, accentColor } = useBuilderAppearance()
const themes: { id: BuilderTheme; name: string; description: string }[] = [
  { id: 'folio', name: 'Folio paper', description: 'Neutral paper & clear sheet borders' },
  { id: 'obsidian', name: 'Obsidian', description: 'Near-black, clear text & rich accents' },
  { id: 'parchment', name: 'Parchment', description: 'Warm paper & soft greens' },
  { id: 'dark', name: 'Moonlight', description: 'Dark surfaces & gentle contrast' },
  { id: 'light', name: 'Daylight', description: 'Clean whites & crisp details' },
]
const accents: { id: BuilderAccent; name: string; color: string }[] = [
  { id: 'crimson', name: 'Crimson', color: '#be3449' },
  { id: 'forest', name: 'Forest', color: '#46765c' },
  { id: 'violet', name: 'Amethyst', color: '#8664b3' },
  { id: 'ocean', name: 'Ocean', color: '#367e9d' },
  { id: 'ember', name: 'Ember', color: '#b46447' },
]
function updateCustomAccent(event: Event) {
  const input = event.target as HTMLInputElement
  if (/^#[0-9a-f]{6}$/i.test(input.value)) appearance.customAccent = input.value.toLowerCase()
}
function restoreInvalidAccent(event: Event) {
  const input = event.target as HTMLInputElement
  if (!/^#[0-9a-f]{6}$/i.test(input.value)) input.value = accentColor.value
}
function applyFolio(){Object.assign(appearance,{theme:'folio',sheetLayout:'folio',sheetTypography:'folio',sheetDensity:'compact',customAccent:'#a62d36',coverage:'subtle'})}
function applyClassic(){Object.assign(appearance,{sheetLayout:'classic',sheetTypography:'classic',sheetDensity:'comfortable'})}
</script>

<template>
  <section v-if="open" id="builder-appearance" class="cb-appearance" aria-labelledby="appearance-heading" @keydown.esc.stop="$emit('close')">
    <div class="cb-appearance-heading">
      <div><h2 id="appearance-heading">Make yourself at home.</h2><p>Customize the whole site. Your preferences are saved on this device.</p></div>
      <button type="button" class="cb-button cb-button-subtle" @click="$emit('close')">Done</button>
    </div>
    <div class="cb-appearance-options">
      <fieldset class="cb-theme-options"><legend>Theme</legend>
        <button v-for="theme in themes" :key="theme.id" type="button" :aria-pressed="appearance.theme === theme.id" class="cb-theme-option" @click="appearance.theme = theme.id">
          <span class="cb-theme-swatch" :data-swatch="theme.id"><i /><i /><i /></span><strong>{{ theme.name }}</strong><small>{{ theme.description }}</small>
        </button>
      </fieldset>
      <div class="cb-appearance-details">
        <fieldset class="cb-accent-options"><legend>Accent color</legend><div>
          <button v-for="accent in accents" :key="accent.id" type="button" :aria-pressed="!appearance.customAccent && appearance.accent === accent.id" :style="{ '--swatch': accent.color }" @click="appearance.accent = accent.id; appearance.customAccent = ''"><span />{{ accent.name }}</button>
        </div></fieldset>
        <label class="cb-field">Custom accent<div class="cb-color-picker"><input type="color" aria-label="Custom accent color" :value="accentColor" @input="appearance.customAccent = ($event.target as HTMLInputElement).value" /><input aria-label="Accent hex color" :value="accentColor" maxlength="7" pattern="#[0-9a-fA-F]{6}" @input="updateCustomAccent" @blur="restoreInvalidAccent" /></div></label>
        <label class="cb-field">Color coverage<select v-model="appearance.coverage"><option value="immersive">Immersive — tint panels, headers & borders</option><option value="subtle">Subtle — focus on controls & highlights</option></select></label>
        <label class="cb-field">Reading size<select v-model="appearance.textSize"><option value="comfortable">Comfortable</option><option value="large">Larger text</option></select></label>
        <label class="cb-field">Character sheet spacing<select v-model="appearance.sheetDensity"><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select><small>Changes spacing without reducing rules text. Works with either reading size.</small></label>
        <label class="cb-field">Character sheet layout<select v-model="appearance.sheetLayout"><option value="folio">Folio — top stats and resource column</option><option value="classic">Classic — original sheet layout</option></select></label>
        <label class="cb-field">Character sheet typography<select v-model="appearance.sheetTypography"><option value="folio">Folio — Barlow & Barlow Condensed</option><option value="classic">Classic — Georgia & system text</option></select></label>
        <button type="button" class="cb-button cb-button-subtle" @click="applyFolio">Use Folio preview style</button>
        <button type="button" class="cb-button cb-button-subtle" @click="applyClassic">Use Classic sheet</button>
        <button type="button" class="cb-text-button" @click="resetAppearance">Restore defaults</button>
      </div>
    </div>
  </section>
</template>
