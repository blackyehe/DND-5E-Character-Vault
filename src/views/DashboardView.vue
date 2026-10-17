<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore, emptyCharacter } from '../stores/characters'

const store = useCharactersStore()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  store.fetchList()
})

async function onCreate() {
  const created = await store.create(emptyCharacter())
  router.push({ name: 'character', params: { id: created._id } })
}

async function onDuplicate(id: string) {
  await store.duplicate(id)
}

async function onDelete(id: string) {
  if (!confirm('Delete this character permanently?')) return
  await store.remove(id)
}

function onExport(id: string, name: string) {
  const filename = `${(name || 'character').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`
  const link = document.createElement('a')
  link.href = `/api/characters/${id}/export`
  link.download = filename
  link.click()
}

function triggerImport() {
  fileInput.value?.click()
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await file.text()
  try {
    const data = JSON.parse(text)
    const created = await store.importCharacter(data)
    router.push({ name: 'character', params: { id: created._id } })
  } catch {
    alert('That file is not valid character JSON.')
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-display text-3xl text-[var(--color-gold-soft)]">Your Characters</h1>
        <p class="text-sm text-[var(--color-ink-soft)] mt-1">Manage your roster of heroes.</p>
      </div>
      <div class="flex gap-3">
        <button class="btn-ghost" @click="triggerImport">Import JSON</button>
        <button class="btn-primary" @click="onCreate">New Character</button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="application/json"
        class="hidden"
        @change="onImportFile"
      />
    </div>

    <p v-if="store.loading && !store.list.length" class="text-[var(--color-ink-soft)]">
      Loading…
    </p>

    <div
      v-else-if="!store.list.length"
      class="panel p-12 text-center text-[var(--color-ink-soft)]"
    >
      <p class="font-display text-xl mb-2 text-[var(--color-parchment)]">No characters yet.</p>
      <p>Forge your first hero to begin your tale.</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="c in store.list"
        :key="c._id"
        class="panel p-5 flex flex-col hover:border-[var(--color-gold)] transition-colors cursor-pointer"
        @click="router.push({ name: 'character', params: { id: c._id } })"
      >
        <div class="flex items-start gap-4">
          <img
            v-if="c.meta.portrait"
            :src="c.meta.portrait"
            class="w-16 h-16 rounded object-cover border border-[#4a3c2a]"
            alt=""
          />
          <div
            v-else
            class="w-16 h-16 rounded bg-[#1e1811] border border-[#4a3c2a] flex items-center justify-center font-display text-2xl text-[var(--color-gold)]"
          >
            {{ c.meta.name?.[0] || '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="font-display text-xl truncate">{{ c.meta.name || 'Unnamed' }}</h2>
            <p class="text-sm text-[var(--color-ink-soft)]">
              Level {{ c.meta.level }} {{ c.meta.race }} {{ c.meta.klass }}
            </p>
          </div>
        </div>

        <p class="text-xs text-[var(--color-ink-soft)] mt-3">
          Updated {{ new Date(c.updatedAt).toLocaleDateString() }}
        </p>

        <div class="flex gap-2 mt-4 pt-4 border-t border-[#3a2e22]" @click.stop>
          <button class="btn-ghost text-xs" @click="onDuplicate(c._id)">Duplicate</button>
          <button class="btn-ghost text-xs" @click="onExport(c._id, c.meta.name)">Export</button>
          <button
            class="btn-ghost text-xs ml-auto text-[var(--color-blood-soft)]"
            @click="onDelete(c._id)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
