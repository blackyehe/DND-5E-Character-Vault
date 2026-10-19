<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { classes } from '../../lib/character-sheet'
import { useIndependentColumns } from '../../composables/useIndependentColumns'
import FeatureText from './FeatureText.vue'
import { isRevenantShadow } from '../../../shared/class-rules'
import { spellReferenceLabel } from '../../lib/spell-reference'
import { innateRaceSpells } from '../../../shared/workshop-race'
import { spellLevelGroups } from '../../lib/spell-level-groups'
const emit=defineEmits<{repair:[index:string]}>()
const store = useCharactersStore(), c = computed(() => store.current!), library = useSheetLibrary()
const query = ref(''), showAll = ref(false)
const innate = computed(()=>innateRaceSpells(c.value).filter(s=>`${s.name} ${s.usage}`.toLowerCase().includes(query.value.toLowerCase())).sort((a,b)=>(library.spells.value[a.index]?.level??10)-(library.spells.value[b.index]?.level??10)||a.name.localeCompare(b.name)))
const knownCaster = computed(() => { const list=classes(c.value); return list.length>0&&list.every(entry=>isRevenantShadow(entry.name)||['bard','ranger','rogue','fighter','sorcerer','warlock'].includes(entry.name.toLowerCase())) })
const groups = computed(() => {
  const spells = [...new Set([...c.value.spellcasting.known,...c.value.spellcasting.prepared])].map(index => {
    const detail = library.spells.value[index]
    return { index, detail, name: detail?.name ?? spellReferenceLabel(index), level: detail?.level, ready: detail?.level===0 || knownCaster.value || c.value.spellcasting.prepared.includes(index) }
  }).filter(s => (showAll.value || s.ready) && `${s.name} ${(s.detail?.desc??[]).join(' ')}`.toLowerCase().includes(query.value.toLowerCase()))
  return spellLevelGroups(spells)
})
const columns=useIndependentColumns(groups,'column')
const missing=computed(()=>[...new Set([...c.value.spellcasting.known,...c.value.spellcasting.prepared])].filter(id=>!library.spells.value[id]||library.spells.value[id]?.referenceFallback||library.spells.value[id]?.definitionAvailable===false))
async function prepare(index:string) {
  if(store.saving)return
  const current=c.value.spellcasting
  try { await store.update(c.value._id,{spellcasting:{...current,known:[...new Set([...current.known,...current.prepared])],prepared:current.prepared.includes(index)?current.prepared.filter(i=>i!==index):[...current.prepared,index]}}) } catch { /* The sheet displays save errors. */ }
}
</script>

<template>
  <section class="sheet-panel sheet-spellbook"><div class="sheet-spellbook-toolbar"><h3>Spells</h3><label class="sheet-search"><span class="sheet-sr-only">Search your spells</span><input v-model="query" type="search" placeholder="Search your spells…" aria-label="Search your spells" /></label><label v-if="!knownCaster" class="sheet-checkbox"><input v-model="showAll" type="checkbox" /> Include unprepared</label><details v-if="store.canEditPermanent" class="sheet-spell-options"><summary>Spell options</summary><button type="button" class="sheet-button sheet-small-button" @click="emit('repair',missing[0]??'')">Manage spell definitions{{missing.length && !library.loading.value ? ` · ${missing.length} to review` : ''}}</button></details></div><p class="sheet-small sheet-spellbook-hint">{{knownCaster?'Known spells are ready; cantrips are at will.':'Cantrips are always ready; preparing a spell does not spend a slot.'}} Track casting in the slots above.</p>
    <section v-if="innate.length" class="sheet-spell-level" style="margin:16px 0"><h4>Innate racial spells <span class="sheet-count">{{innate.length}}</span></h4><p class="sheet-small">Separate racial grants; these do not count against your class spell choices. Follow each spell’s casting limits.</p><div v-for="spell in innate" :key="spell.id" class="sheet-feature-row"><details><summary>{{spell.name}}<small>{{spell.source}} · {{spell.ability.toUpperCase()}} · gained at character level {{spell.level}}</small></summary><p class="sheet-prose">{{spell.usage||'Casting limits have not been recorded.'}}</p><p v-if="spell.needsReview" class="sheet-small">Casting rules need DM review.</p><template v-if="library.spells.value[spell.index]"><p class="sheet-small">{{library.spells.value[spell.index]!.casting_time}} · {{library.spells.value[spell.index]!.range}} · {{library.spells.value[spell.index]!.duration}}</p><FeatureText :text="library.spells.value[spell.index]!.desc.join('\n\n')" /></template><p v-else class="sheet-prose">The spell reference is preserved. Its full definition is currently unavailable.</p></details></div></section>
    <p v-if="!groups.length&&!innate.length" class="sheet-empty">{{library.loading.value?'Loading spell details…':'No matching spells. Manage your spellbook in Edit character.'}}</p>
    <div class="sheet-spell-grid" :data-columns="columns.length"><div v-for="(column,index) in columns" :key="index" class="sheet-independent-column"><section v-for="group in column" :key="group.level" class="sheet-spell-level"><h4>{{group.title}} <span class="sheet-count">{{group.spells.length}}</span></h4><div v-for="spell in group.spells" :key="spell.index" class="sheet-feature-row"><details><summary>{{spell.name}}<small v-if="spell.detail">{{spell.detail.casting_time}} · {{spell.detail.range}}{{spell.detail.concentration?' · Concentration':''}}{{spell.detail.ritual?' · Ritual':''}}</small></summary><template v-if="spell.detail&&spell.detail.definitionAvailable!==false"><p v-if="spell.detail.referenceFallback" class="sheet-small">Using the matching SRD definition because the original imported reference is unavailable.</p><p class="sheet-small" style="margin-top:10px">{{spell.detail.school?.name}} · {{spell.detail.components?.join(', ')}} · {{spell.detail.duration}}</p><p class="sheet-small">Definition: {{spell.detail.sourcePack||'SRD 2014'}}</p><FeatureText :text="spell.detail.desc.join('\n\n')" /><p v-for="(line,i) in spell.detail.higher_level" :key="`higher-${i}`" class="sheet-prose"><strong>At higher levels: </strong>{{line}}</p></template><p v-else class="sheet-prose">The original reference is preserved. Its definition is currently unavailable.</p></details><button v-if="spell.level!==0&&!knownCaster" class="sheet-button sheet-small-button" :disabled="store.saving" :aria-pressed="spell.ready" @click="prepare(spell.index)">{{spell.ready?'Prepared':'Prepare'}}</button><span v-else class="sheet-small">{{spell.level===0?'At will':'Known'}}</span></div></section></div></div>
  </section>
</template>
