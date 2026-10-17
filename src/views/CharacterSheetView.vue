<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '../stores/characters'
import CoreTab from '../components/sheet/CoreTab.vue'
import CombatTab from '../components/sheet/CombatTab.vue'
import EquipmentSpellsTab from '../components/sheet/EquipmentSpellsTab.vue'
import BioTab from '../components/sheet/BioTab.vue'
import {
  profBonus,
  initiative,
} from '../lib/calc'

const route = useRoute()
const router = useRouter()
const store = useCharactersStore()

const id = computed(() => route.params.id as string)
const activeTab = ref<'core' | 'combat' | 'equipment' | 'bio'>('core')

const tabs = [
  { key: 'core', label: 'Core' },
  { key: 'combat', label: 'Combat' },
  { key: 'equipment', label: 'Equipment & Spells' },
  { key: 'bio', label: 'Bio & Notes' },
] as const

onMounted(async () => {
  await store.fetchOne(id.value)
})

watch(id, async (newId) => {
  if (newId) await store.fetchOne(newId)
})

function save(patch: Record<string, unknown>) {
  if (!store.current) return
  store.update(id.value, patch)
}

const header = computed(() => {
  const c = store.current
  if (!c) return null
  return {
    name: c.meta.name,
    klass: c.meta.klass,
    level: c.meta.level,
    ac: c.combat.ac,
    hp: c.combat.hpCurrent,
    hpMax: c.combat.hpMax,
    init: initiative(c.abilities.dex),
    speed: c.combat.speed,
    pb: profBonus(c.meta.level),
  }
})
</script>

<template>
  <div>
    <div
      v-if="header"
      class="sticky top-0 z-20 bg-[#241c13] border-b border-[#4a3c2a] px-6 py-3"
    >
      <div class="max-w-6xl mx-auto flex items-center gap-6 flex-wrap">
        <button class="btn-ghost text-xs" @click="router.push('/')">← Back</button>
        <div class="flex-1 min-w-[200px]">
          <input
            :value="header.name"
            class="font-display text-2xl bg-transparent border-none outline-none text-[var(--color-gold-soft)] w-full"
            placeholder="Character name"
            @change="save({ meta: { ...store.current!.meta, name: ($event.target as HTMLInputElement).value } })"
          />
          <p class="text-sm text-[var(--color-ink-soft)]">
            Level {{ header.level }} {{ header.klass }}
          </p>
        </div>
        <div class="flex gap-5 text-center">
          <div>
            <div class="label-micro">AC</div>
            <div class="font-display text-2xl">{{ header.ac }}</div>
          </div>
          <div>
            <div class="label-micro">HP</div>
            <div class="font-display text-2xl">{{ header.hp }}/{{ header.hpMax }}</div>
          </div>
          <div>
            <div class="label-micro">Init</div>
            <div class="font-display text-2xl">{{ header.init >= 0 ? '+' : '' }}{{ header.init }}</div>
          </div>
          <div>
            <div class="label-micro">Speed</div>
            <div class="font-display text-2xl">{{ header.speed }}</div>
          </div>
          <div>
            <div class="label-micro">Prof</div>
            <div class="font-display text-2xl">+{{ header.pb }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="store.current" class="max-w-6xl mx-auto px-6 py-6">
      <div class="flex border-b border-[#4a3c2a] mb-6">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="sheet-tab"
          :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <CoreTab v-if="activeTab === 'core'" />
      <CombatTab v-else-if="activeTab === 'combat'" />
      <EquipmentSpellsTab v-else-if="activeTab === 'equipment'" />
      <BioTab v-else />
    </div>

    <p v-else class="text-center text-[var(--color-ink-soft)] py-16">Loading character…</p>
  </div>
</template>
