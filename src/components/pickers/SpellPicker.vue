<script setup lang="ts">
import { ref, watch } from 'vue'
import { srd, type SrdRef } from '../../lib/srd'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'pick', index: string): void
}>()

const query = ref('')
const results = ref<SrdRef[]>([])
const loading = ref(false)
const error = ref('')

let timer: ReturnType<typeof setTimeout> | undefined

watch(
  query,
  (q) => {
    clearTimeout(timer)
    if (!q.trim()) {
      results.value = []
      return
    }
    timer = setTimeout(async () => {
      loading.value = true
      error.value = ''
      try {
        results.value = await srd.spells({ name: q.trim() })
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Lookup failed'
      } finally {
        loading.value = false
      }
    }, 300)
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
    @click.self="emit('close')"
  >
    <div class="panel w-full max-w-lg max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-[#3a2e22] flex items-center gap-3">
        <input
          v-model="query"
          class="input-base flex-1"
          placeholder="Search spells…"
          autofocus
        />
        <button class="btn-ghost text-xs" @click="emit('close')">✕</button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <p v-if="loading" class="text-sm text-[var(--color-ink-soft)]">Searching…</p>
        <p v-else-if="error" class="text-sm text-[var(--color-blood-soft)]">{{ error }}</p>
        <p v-else-if="!results.length" class="text-sm text-[var(--color-ink-soft)]">
          No spells found.
        </p>

        <ul v-else class="space-y-1">
          <li
            v-for="r in results"
            :key="r.index"
            class="p-2 rounded hover:bg-[#3a2e22] cursor-pointer capitalize"
            @click="emit('pick', r.index)"
          >
            {{ r.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
