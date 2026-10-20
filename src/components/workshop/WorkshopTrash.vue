<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import { announceWorkshopChange, deviceTrash, restoreCreation, type DeletedCreation } from '../../lib/workshop-trash'
const emit = defineEmits<{ changed: [] }>()
const auth = useAuthStore(), entries = ref<DeletedCreation[]>([]), loading = ref(false), busy = ref(''), error = ref(''), notice = ref('')
async function load() {
  loading.value = true; error.value = ''
  const results = await Promise.allSettled([api.get<DeletedCreation[]>('/api/workshop-trash', { timeoutMs: 60000 }), Promise.resolve().then(() => deviceTrash(auth.user?.id ?? 'local'))])
  entries.value = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  error.value = results.filter(result => result.status === 'rejected').map(result => (result as PromiseRejectedResult).reason.message).join(' ')
  loading.value = false
}
async function restore(entry: DeletedCreation) {
  if (busy.value) return
  busy.value = entry.id; error.value = ''; notice.value = ''
  try { const result = await restoreCreation(entry, auth.user?.id ?? 'local'); notice.value = result.message; announceWorkshopChange(); emit('changed'); await load() }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = '' }
}
onMounted(load)
</script>
<template><section class="hw-panel hw-trash"><header class="hw-between"><div><h2>Recently deleted</h2><p class="hw-hint">Restore creations to their original library or pack. Device drafts are available only in this browser.</p></div><button class="hw-button" :disabled="loading || !!busy" @click="load">Reload</button></header>
  <p class="hw-hint">Saved definitions stay recoverable while their original pack is kept. Complete site backups include saved recovery data.</p>
  <p v-if="notice" class="hw-save-status" role="status">{{ notice }}</p><p v-if="error" class="hw-alert" role="alert">{{ error }}</p><p v-if="loading" role="status">Loading deleted creations…</p><p v-else-if="!entries.length && !error" class="hw-hint">No deleted creations.</p>
  <div v-for="entry in entries" :key="entry.scope + entry.id" class="hw-trash-row"><div><strong>{{ entry.name }}</strong><small>{{ entry.kind === 'monster-action' ? 'Reusable action' : entry.kind }} · {{ entry.packName || (entry.scope === 'draft' ? 'This device' : 'Account library') }} · {{ new Date(entry.deletedAt).toLocaleDateString() }}</small></div><button class="hw-button" :disabled="!!busy" :aria-label="`Restore ${entry.name}`" @click="restore(entry)">{{ busy === entry.id ? 'Restoring…' : 'Restore' }}</button></div>
</section></template>
