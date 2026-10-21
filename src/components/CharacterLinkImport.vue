<script setup lang="ts">
import ItemRules from './sheet/ItemRules.vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import { useCharactersStore, type Character } from '../stores/characters'
import { ABILITY_KEYS } from '../lib/calc'

const props = defineProps<{ stayOnPage?: boolean; beforeImport?: () => boolean }>()
const emit = defineEmits<{ close: []; imported: [character: Character]; saving: [value: boolean] }>()
interface Preview { character: Omit<Character, '_id' | 'updatedAt'>; warnings: string[]; matchedSpells: number; unresolvedSpells: string[]; sourceUrl: string }
const router = useRouter(), store = useCharactersStore()
const url = ref(''), error = ref(''), busy = ref(false), saving = ref(false)
watch(saving, value => emit('saving', value), { flush: 'sync' })
const preview = ref<Preview | null>(null), file = ref<HTMLInputElement | null>(null)
const valid = computed(() => {
  const c = preview.value?.character
  return c && c.meta.name.trim() && Number.isInteger(c.meta.level) && c.meta.level >= 1 && c.meta.level <= 20
    && ABILITY_KEYS.every((key) => Number.isInteger(c.abilities[key]) && c.abilities[key] >= 1 && c.abilities[key] <= 35)
    && Number.isInteger(c.combat.hpMax) && c.combat.hpMax > 0 && Number.isInteger(c.combat.ac) && c.combat.ac > 0
    && Number.isInteger(c.combat.speed) && c.combat.speed >= 0
})
async function load(input: { url: string } | { source: string }) {
  if (busy.value || saving.value) return
  error.value = ''; preview.value = null; busy.value = true
  try { preview.value = await api.post<Preview>('/api/characters/import/dmv/preview', input) }
  catch (failure) { error.value = failure instanceof Error ? failure.message : 'Could not read that character.' }
  finally { busy.value = false }
}
async function readFile(event: Event) {
  const input = event.target as HTMLInputElement, selected = input.files?.[0]
  if (!selected) return
  try {
    if (selected.size > 4 * 1024 * 1024) { error.value = 'Character data must be 4 MB or smaller.'; return }
    await load({ source: await selected.text() })
  } catch { error.value = 'Could not read that file. Try selecting it again.' }
  finally { input.value = '' }
}
async function importCharacter() {
  if (!preview.value || !valid.value || saving.value) return
  if (props.beforeImport && !props.beforeImport()) return
  saving.value = true; error.value = ''
  try {
    const c = preview.value.character
    const created = await store.create({ ...c, combat: { ...c.combat, hpCurrent: Math.min(c.combat.hpCurrent, c.combat.hpMax) } })
    if (props.stayOnPage) { emit('imported', created); preview.value = null; url.value = '' }
    else await router.push({ name: 'character', params: { id: created._id } })
  } catch (failure) { error.value = failure instanceof Error ? failure.message : 'Could not import the character. Your preview is still here.' }
  finally { saving.value = false }
}
function downloadSource() {
  const c = preview.value?.character
  if (!c?.externalImport) return
  const link = document.createElement('a')
  let format = 'edn'
  try { JSON.parse(c.externalImport.source); format = 'json' } catch { /* EDN retains its original format. */ }
  const download = URL.createObjectURL(new Blob([c.externalImport.source], { type: `application/${format};charset=utf-8` }))
  link.href = download; link.download = `${c.meta.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'character'}-original.${format}`; link.click()
  setTimeout(() => URL.revokeObjectURL(download), 1000)
}
</script>

<template>
  <section class="panel link-import mb-8" aria-labelledby="link-import-title">
    <header><div><span class="eyebrow">BRING YOUR HERO WITH YOU</span><h2 id="link-import-title">Import from Dungeon Master’s Vault</h2><p>Paste a shared character link, review the result, then import it as a new character.</p></div><button class="btn-ghost" :disabled="busy || saving" aria-label="Close character import" @click="$emit('close')">✕</button></header>
    <form class="source" @submit.prevent="load({ url: url.trim() })"><label>Character link<input v-model="url" class="input-base" type="url" required maxlength="2048" placeholder="https://www.dungeonmastersvault.com/pages/dnd/5e/characters/…" :disabled="busy || saving" /></label><button class="btn-primary" :disabled="busy || saving || !url.trim()">{{ busy ? 'Reading character…' : 'Preview character' }}</button></form>
    <div class="fallback"><span>Have character data instead?</span><button class="btn-ghost text-xs" type="button" :disabled="busy || saving" @click="file?.click()">Choose EDN / JSON file</button><input ref="file" class="hidden" type="file" accept=".edn,.json,.orc,.orcpub,application/edn,application/json,text/plain" @change="readFile" /></div>
    <p v-if="busy" class="status" role="status">Reading the saved choices and matching them with your available content…</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="preview" class="preview">
      <div class="summary"><div><span class="eyebrow">CHARACTER FOUND</span><h3>{{ preview.character.meta.name }}</h3><p>Level {{ preview.character.meta.level }} · {{ preview.character.meta.race }} · {{ preview.character.meta.klass }}{{ preview.character.meta.subclass ? ` · ${preview.character.meta.subclass}` : '' }}</p></div><span class="pill">{{ preview.matchedSpells }} matched spells · {{ preview.character.equipment.length }} items</span></div>
      <aside class="review"><strong>Review before importing</strong><p>A shared link stores character choices. Homebrew and special rules can affect the final numbers.</p><ul><li v-for="warning in preview.warnings" :key="warning">{{ warning }}</li></ul></aside>
      <fieldset :disabled="saving"><legend>Confirm the essentials</legend><div class="meta"><label>Name<input v-model="preview.character.meta.name" class="input-base" maxlength="200" /></label><label>Level<input v-model.number="preview.character.meta.level" class="input-base" type="number" min="1" max="20" /></label></div>
        <div class="abilities"><label v-for="key in ABILITY_KEYS" :key="key">{{ key.toUpperCase() }}<input v-model.number="preview.character.abilities[key]" class="input-base" type="number" min="1" max="35" :aria-label="`Imported ${key.toUpperCase()} score`" /></label></div>
        <div class="combat"><label>Maximum HP<input v-model.number="preview.character.combat.hpMax" class="input-base" type="number" min="1" /></label><label>Armor class<input v-model.number="preview.character.combat.ac" class="input-base" type="number" min="1" /></label><label>Speed (feet)<input v-model.number="preview.character.combat.speed" class="input-base" type="number" min="0" /></label></div>
      </fieldset>
      <details><summary>Imported inventory ({{ preview.character.equipment.length }})</summary><details v-for="(item,index) in preview.character.equipment" :key="index"><summary>{{item.name}} · {{item.qty}}</summary><ItemRules :item="item" /></details></details>
      <details><summary>Imported choices & traits ({{ preview.character.features.length }})</summary><div v-for="(feature, index) in preview.character.features" :key="index"><strong>{{ feature.name }}</strong><p>{{ feature.description }}</p></div></details>
      <footer><button class="btn-ghost" :disabled="saving" @click="downloadSource">Download original choices</button><p>The original data stays attached to your character.</p><button class="btn-primary" :disabled="!valid || saving" @click="importCharacter">{{ saving ? 'Importing…' : 'Import character' }}</button></footer>
      <p v-if="!valid" class="error">Check the name, level, abilities, and combat values before importing.</p>
    </div>
  </section>
</template>

<style scoped>
.link-import{padding:26px}.link-import header{display:flex;justify-content:space-between;gap:18px}.link-import h2{font:26px Georgia,serif;margin:7px 0 10px}.link-import header p,.summary p{font-size:13px;color:var(--cb-muted);line-height:1.7}.eyebrow{font-size:10px;letter-spacing:.13em;color:var(--cb-accent-text);font-weight:600}.link-import header>.btn-ghost{align-self:start}.source{display:flex;gap:12px;align-items:end;margin-top:23px}.source>label{flex:1}.source label,fieldset label{font-size:12px;color:var(--cb-muted);display:flex;flex-direction:column;gap:7px}.source input{font-size:13px;padding:11px}.source>.btn-primary{min-height:43px}.fallback{display:flex;align-items:center;gap:12px;color:var(--cb-muted);font-size:12px;margin-top:14px;flex-wrap:wrap}.status{margin:20px 0;color:var(--cb-muted)}.error{color:var(--site-danger);font-size:13px;margin-top:18px;line-height:1.7}.preview{margin-top:24px;padding-top:24px;border-top:1px solid var(--cb-line)}.summary{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}.summary h3{font:29px Georgia,serif;margin:5px 0;color:var(--cb-ink)}.pill{background:var(--cb-accent-soft);color:var(--cb-accent-text);padding:8px 11px;border-radius:5px;font-size:12px}.review{background:var(--cb-soft);border:1px solid var(--cb-line);border-left:3px solid var(--cb-accent-mark);padding:17px 20px;margin:20px 0;border-radius:5px;font-size:12px;line-height:1.8}.review>strong{font-size:14px;color:var(--cb-ink)}.review p,.review ul{margin-top:9px;color:var(--cb-muted)}.review ul{list-style:disc;padding-left:18px}.review li+li{margin-top:5px}fieldset{border:0;margin-top:24px;padding:0;min-width:0}legend{font:21px Georgia,serif;margin-bottom:15px}.meta{display:grid;grid-template-columns:1fr 120px;gap:15px}.abilities{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:13px;margin:17px 0}.abilities input{text-align:center;font-size:21px;padding:10px}.combat{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.link-import details{margin-top:24px;border-top:1px solid var(--cb-line);padding-top:18px}.link-import summary{cursor:pointer;color:var(--cb-accent-text);font-size:13px}.link-import details>div{border-bottom:1px solid var(--cb-line);padding:14px 0;font-size:12px}.link-import details p{white-space:pre-wrap;line-height:1.8;color:var(--cb-muted);margin-top:8px;overflow-wrap:anywhere}.link-import footer{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap;border-top:1px solid var(--cb-line);padding-top:20px;margin-top:22px}.link-import footer p{color:var(--cb-muted);font-size:11px;flex:1}.link-import footer button{font-size:13px}@media(max-width:650px){.link-import{padding:18px}.source{flex-direction:column;align-items:stretch}.abilities{grid-template-columns:repeat(3,minmax(0,1fr))}.meta{grid-template-columns:1fr 75px}.link-import footer{align-items:stretch;flex-direction:column}.combat{gap:9px}.link-import h2{font-size:23px}}
</style>
