<script setup lang="ts">
import type {SrdSpell} from '../../lib/srd'
import type {SpellProfile} from '../../lib/spell-profile'
import {signed} from '../../lib/character-sheet'
import SpellCastingDetails from '../SpellCastingDetails.vue'
import FeatureText from './FeatureText.vue'
defineProps<{name:string;spell?:SrdSpell;profile:SpellProfile}>()
</script>
<template>
 <article class="spellbook-entry">
  <details class="spellbook-rule">
   <summary><span class="spellbook-identity"><strong>{{name}}</strong><small>{{profile.source}} · {{profile.ability}}</small></span><span class="spellbook-result"><span v-if="profile.attack!==undefined" class="spellbook-attack" :aria-label="`Spell attack: 1d20 ${signed(profile.attack)}`">1d20 {{signed(profile.attack)}}</span><span v-if="profile.save" class="spellbook-save">{{profile.save.ability}} save DC {{profile.save.dc}}</span><small v-if="profile.note">{{profile.note}}</small></span><span class="spellbook-chevron" aria-hidden="true">⌄</span></summary>
   <div class="spellbook-body"><slot /><template v-if="spell&&spell.definitionAvailable!==false"><p v-if="spell.referenceFallback" class="sheet-small">Using the matching SRD definition because the original imported reference is unavailable.</p><p class="sheet-small">{{spell.level===0?'Cantrip':`Level ${spell.level}`}}<template v-if="spell.school?.name"> · {{spell.school.name}}</template></p><SpellCastingDetails :spell="spell" /><p class="sheet-small">Definition: {{spell.sourcePack||(spell.homebrew?'Homebrew':'SRD 2014')}}</p><FeatureText :text="spell.desc.join('\n\n')" /><p v-for="(line,i) in spell.higher_level" :key="i" class="sheet-prose"><strong>At higher levels: </strong>{{line}}</p></template><p v-else class="sheet-prose">The original reference is preserved. Its full definition is currently unavailable.</p></div>
  </details>
  <div v-if="$slots.actions" class="spellbook-actions"><slot name="actions" /></div>
 </article>
</template>
<style scoped>
.spellbook-entry{display:flex;align-items:flex-start;gap:8px;margin:8px 0;min-width:0;font-variant-numeric:tabular-nums}.spellbook-rule{flex:1;min-width:0;background:var(--sheet-entry-bg);border-radius:6px;overflow:hidden}.spellbook-rule>summary{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;list-style:none;min-height:64px;color:var(--cb-ink)}.spellbook-rule>summary::-webkit-details-marker{display:none}.spellbook-identity{display:grid;gap:3px;flex:1;min-width:0;overflow-wrap:anywhere}.spellbook-identity strong{font-size:calc(15px * var(--cb-text-scale,1));font-weight:600}.spellbook-identity small,.spellbook-result small{font-size:calc(12px * var(--cb-text-scale,1));color:var(--cb-ink);opacity:1}.spellbook-result{display:flex;flex-direction:column;align-items:flex-end;gap:5px;max-width:52%;text-align:right;overflow-wrap:anywhere;font-size:calc(14px * var(--cb-text-scale,1));font-weight:600}.spellbook-attack{display:inline-block;padding:4px 8px;border-radius:4px;white-space:nowrap;background:var(--sheet-trained-bg);color:var(--cb-ink)}.spellbook-chevron{flex-shrink:0;opacity:.7}.spellbook-rule[open] .spellbook-chevron{transform:rotate(180deg)}.spellbook-body{padding:12px 14px;background:var(--sheet-body-bg)}.spellbook-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;max-width:94px;flex-shrink:0;padding-top:12px;gap:5px}.spellbook-rule>summary:focus-visible{outline:2px solid var(--cb-accent-mark);outline-offset:-3px}.spellbook-rule>summary:hover{background:var(--sheet-hover-bg)}
@media(max-width:560px){.spellbook-entry{flex-wrap:wrap;gap:4px}.spellbook-rule{flex-basis:100%}.spellbook-rule>summary{padding:10px;gap:7px}.spellbook-actions{max-width:none;padding-top:0;margin-left:auto}.spellbook-body{padding:10px}.spellbook-result{font-size:calc(13px * var(--cb-text-scale,1))}}
</style>
