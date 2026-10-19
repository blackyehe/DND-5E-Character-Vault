<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '../stores/characters'
import CharacterLinkImport from '../components/CharacterLinkImport.vue'
import { api } from '../lib/api'

const store = useCharactersStore()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const showLinkImport = ref(false)
const importBusy = ref(false), importMessage = ref('')

onMounted(() => {
  store.fetchList()
})

function onCreate() {
  router.push({ name: 'character-new' })
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
  importBusy.value = true; importMessage.value = ''
  try {
    const data = JSON.parse(text)
    if (['codex-public-migration','codex-of-heroes-backup'].includes(data.format)) {
      if (!window.confirm(`Restore ${data.characters?.length ?? 0} characters and ${data.content?.length ?? 0} content entries into this account? The account must be empty; no existing data will be overwritten.`)) return
      const restored = await api.post<{characters:number;content:number}>('/api/library-restore', data)
      importMessage.value = `Restored ${restored.characters} characters and ${restored.content} content entries.`
      await store.fetchList()
      return
    }
    const created = await store.importCharacter(data)
    router.push({ name: 'character', params: { id: created._id } })
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'That file could not be imported.'
  } finally {
    input.value = ''
    importBusy.value = false
  }
}
</script>

<template>
  <div class="dashboard-page max-w-6xl mx-auto px-6 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-display text-3xl text-[var(--color-gold-soft)]">Your Characters</h1>
        <p class="text-sm text-[var(--color-ink-soft)] mt-1">Manage your roster of heroes.</p>
      </div>
      <div class="flex gap-3 flex-wrap justify-end">
        <button class="btn-ghost" :aria-expanded="showLinkImport" @click="showLinkImport = !showLinkImport">Import character link</button>
        <button class="btn-ghost" :disabled="importBusy" @click="triggerImport">{{importBusy?'Importing…':'Import JSON / backup'}}</button>
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

    <CharacterLinkImport v-if="showLinkImport" @close="showLinkImport = false" />
    <p v-if="importMessage" class="text-sm mb-4" role="status">{{importMessage}}</p>

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
            class="w-16 h-16 rounded object-cover border border-[var(--cb-line)]"
            alt=""
          />
          <div
            v-else
            class="w-16 h-16 rounded bg-[var(--cb-field)] border border-[var(--cb-line)] flex items-center justify-center font-display text-2xl text-[var(--color-gold)]"
          >
            {{ c.meta.name?.[0] || '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="font-display text-xl truncate">{{ c.meta.name || 'Unnamed' }}</h2><p v-if="c.companionKind==='shadow-champion'" class="text-xs text-[var(--color-gold)]">Shadow Champion</p>
            <p class="text-sm text-[var(--color-ink-soft)]">
              Level {{ c.meta.level }} {{ c.meta.race }} {{ c.meta.klass }}
            </p>
          </div>
        </div>

        <p class="text-xs text-[var(--color-ink-soft)] mt-3">
          Updated {{ new Date(c.updatedAt).toLocaleDateString() }}
        </p>

        <div class="flex gap-2 mt-4 pt-4 border-t border-[var(--cb-soft)]" @click.stop>
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
