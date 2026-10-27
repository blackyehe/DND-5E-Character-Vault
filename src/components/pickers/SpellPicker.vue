<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { contentLabel, homebrew, srd, type SrdRef } from '../../lib/srd'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'pick', index: string): void
}>()

const query = ref('')
const results = ref<SrdRef[]>([])
const loading = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let sequence = 0
let customRequest: ReturnType<typeof homebrew.spells> | undefined

async function search(term: string, requestNumber: number) {
  loading.value = true
  error.value = ''
  const [custom, standard] = await Promise.allSettled([
    customRequest ??= homebrew.spells(),
    term ? srd.spells({ name: term }) : Promise.resolve([] as SrdRef[]),
  ])
  if (requestNumber !== sequence) return
  results.value = [custom, standard].flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .filter((spell) => !term || contentLabel(spell).toLowerCase().includes(term.toLowerCase()))
  if (custom.status === 'rejected' || standard.status === 'rejected') error.value = 'Some spell sources could not be loaded.'
  loading.value = false
}

watch(
  query,
  (q) => {
    const requestNumber = ++sequence
    clearTimeout(timer)
    timer = setTimeout(() => search(q.trim(), requestNumber), q.trim() ? 300 : 0)
  },
  { immediate: true },
)
onBeforeUnmount(() => { clearTimeout(timer); ++sequence })
</script>

<template>
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
    role="dialog"
    aria-modal="true"
    aria-label="Choose a spell"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div class="panel spell-picker-frame w-full max-w-lg max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-[var(--cb-soft)] flex items-center gap-3">
        <input
          v-model="query"
          class="input-base flex-1"
          placeholder="Search spells…"
          autofocus
        />
        <button type="button" class="btn-ghost text-xs" aria-label="Close spell picker" @click="emit('close')">✕</button>
      </div>

      <div class="spell-picker-results flex-1 overflow-y-auto p-4">
        <p v-if="loading" class="text-sm text-[var(--color-ink-soft)]">Searching…</p>
        <p v-if="error" class="text-sm text-[var(--color-blood-soft)]" role="alert">{{ error }}</p>
        <p v-if="!loading && !results.length" class="text-sm text-[var(--color-ink-soft)]">
          No spells found.
        </p>

        <ul v-if="!loading && results.length" class="space-y-1">
          <li
            v-for="r in results"
            :key="r.index"
          >
            <button type="button" class="p-2 rounded hover:bg-[var(--cb-soft)] cursor-pointer capitalize w-full text-left" @click="emit('pick', r.index)">
            {{ contentLabel(r) }}
            <span v-if="'homebrew' in r && r.homebrew" class="ml-2 text-xs text-[var(--color-gold-soft)]">Homebrew</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
