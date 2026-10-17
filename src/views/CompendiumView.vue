<script setup lang="ts">
import { ref, watch } from 'vue'
import { srd, type SrdRef, type SrdSpell, type SrdMonster } from '../lib/srd'

const tab = ref<'spells' | 'monsters' | 'classes' | 'races'>('spells')
const query = ref('')
const results = ref<SrdRef[]>([])
const loading = ref(false)
const detail = ref<SrdSpell | SrdMonster | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined

async function search() {
  loading.value = true
  detail.value = null
  try {
    if (tab.value === 'spells') {
      results.value = await srd.spells(query.value ? { name: query.value } : undefined)
    } else if (tab.value === 'monsters') {
      results.value = await srd.monsters(query.value ? { name: query.value } : undefined)
    } else if (tab.value === 'classes') {
      results.value = await srd.classes()
    } else {
      results.value = await srd.races()
    }
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, 300)
})

watch(tab, search)

async function openDetail(index: string) {
  try {
    if (tab.value === 'spells') detail.value = await srd.spell(index)
    else if (tab.value === 'monsters') detail.value = await srd.monster(index)
    else if (tab.value === 'classes') detail.value = (await srd.class(index)) as unknown as SrdSpell
    else detail.value = (await srd.race(index)) as unknown as SrdSpell
  } catch {
    /* ignore */
  }
}

// kick off initial load
search()
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8">
    <h1 class="font-display text-3xl text-[var(--color-gold-soft)] mb-6">Compendium</h1>

    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="t in ['spells', 'monsters', 'classes', 'races']"
        :key="t"
        class="btn-ghost text-sm capitalize"
        :class="{ '!border-[var(--color-gold)] !text-[var(--color-gold-soft)]': tab === t }"
        @click="tab = t as typeof tab"
      >
        {{ t }}
      </button>
      <input v-model="query" class="input-base max-w-xs ml-auto" :placeholder="`Search ${tab}…`" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="panel p-4 lg:col-span-1 max-h-[70vh] overflow-y-auto">
        <p v-if="loading" class="text-sm text-[var(--color-ink-soft)]">Loading…</p>
        <ul v-else class="space-y-1">
          <li
            v-for="r in results"
            :key="r.index"
            class="p-2 rounded hover:bg-[#3a2e22] cursor-pointer capitalize text-sm"
            @click="openDetail(r.index)"
          >
            {{ r.name }}
          </li>
        </ul>
      </div>

      <div class="panel p-6 lg:col-span-2 min-h-[200px]">
        <p v-if="!detail" class="text-[var(--color-ink-soft)]">
          Select an entry to read its description.
        </p>
        <div v-else>
          <h2 class="font-display text-2xl text-[var(--color-gold-soft)] mb-2 capitalize">
            {{ detail.name }}
          </h2>

          <template v-if="tab === 'spells'">
            <p class="text-sm text-[var(--color-ink-soft)] mb-4">
              Level {{ (detail as SrdSpell).level }}
              {{ (detail as SrdSpell).school?.name ?? '' }} ·
              {{ (detail as SrdSpell).casting_time }} · {{ (detail as SrdSpell).range }}
            </p>
            <div v-for="(para, i) in (detail as SrdSpell).desc ?? []" :key="i" class="mb-3 leading-relaxed">
              {{ para }}
            </div>
          </template>

          <template v-else>
            <pre class="whitespace-pre-wrap text-sm leading-relaxed">{{
              JSON.stringify(detail, null, 2)
            }}</pre>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
