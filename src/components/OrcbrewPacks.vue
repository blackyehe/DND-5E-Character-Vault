<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../lib/api'

interface OrcbrewPack {
  id: string
  filename: string
  includeDisabled?: boolean
  error?: string
  report?: {
    packCount: number
    entryCount: number
    duplicateCount: number
    disabledCount: number
    counts: Record<string, number>
    warnings: string[]
  }
}

const packs = ref<OrcbrewPack[]>([])
const packSearch=ref(''),contentKind=ref('')
const contentKinds=computed(()=>[...new Set(packs.value.flatMap(pack=>Object.entries(pack.report?.counts??{}).filter(([,count])=>count>0).map(([kind])=>kind)))].sort())
const visiblePacks=computed(()=>packs.value.filter(pack=>pack.filename.toLowerCase().includes(packSearch.value.trim().toLowerCase())&&(!contentKind.value||(pack.report?.counts[contentKind.value]??0)>0)))
const loading = ref(false)
const importing = ref(false)
const changingPack = ref('')
const error = ref('')
const notice = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const maxFileBytes = 8 * 1024 * 1024

async function loadPacks() {
  loading.value = true
  error.value = ''
  try {
    packs.value = await api.get<OrcbrewPack[]>('/api/content/orcbrew-packs')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not load your files.'
  } finally {
    loading.value = false
  }
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  error.value = ''
  notice.value = ''
  if (!file.name.toLowerCase().endsWith('.orcbrew')) {
    error.value = 'Choose a file with the .orcbrew extension.'
    return
  }
  if (file.size > maxFileBytes) {
    error.value = 'Files must be 8 MB or smaller.'
    return
  }

  importing.value = true
  try {
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer())
    if (!source.trim().startsWith('{')) {
      error.value = 'This does not look like an Orcbrew data file.'
      return
    }
    const result = await api.post<OrcbrewPack & { duplicate: boolean }>('/api/content/orcbrew-packs', { filename: file.name, source })
    notice.value = result.duplicate ? `${file.name} is already imported.` : `${file.name} imported. Identical entries are merged automatically.`
    await loadPacks()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not import this file.'
  } finally {
    importing.value = false
  }
}

async function exportPack(pack: OrcbrewPack) {
  error.value = ''
  try {
    const response = await fetch(`/api/content/orcbrew-packs/${pack.id}/export`, { credentials: 'include' })
    if (!response.ok) throw new Error('Could not download this file.')
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = pack.filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not download this file.'
  }
}

function countsText(pack: OrcbrewPack) {
  return Object.entries(pack.report?.counts ?? {}).filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}`).join(' · ')
}

async function toggleDisabled(pack: OrcbrewPack, event: Event) {
  changingPack.value = pack.id
  error.value = ''
  try {
    const updated = await api.patch<OrcbrewPack>(`/api/content/orcbrew-packs/${pack.id}`, {
      includeDisabled: (event.target as HTMLInputElement).checked,
    })
    packs.value = packs.value.map((item) => item.id === updated.id ? updated : item)
  } catch (cause) {
    ;(event.target as HTMLInputElement).checked = pack.includeDisabled === true
    error.value = cause instanceof Error ? cause.message : 'Could not update this file.'
  } finally {
    changingPack.value = ''
  }
}

async function deletePack(pack: OrcbrewPack) {
  if (!window.confirm(`Remove ${pack.filename} from your saved homebrew files?`)) return
  error.value = ''
  notice.value = ''
  try {
    await api.delete(`/api/content/orcbrew-packs/${pack.id}`)
    packs.value = packs.value.filter((item) => item.id !== pack.id)
    notice.value = `${pack.filename} removed.`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not remove this file.'
  }
}

onMounted(loadPacks)
</script>

<template>
  <section class="space-y-5">
    <div class="panel p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="font-display text-xl text-[var(--color-gold-soft)]">Orcbrew files</h2>
        <p class="mt-1 text-sm text-[var(--color-ink-soft)]">
          Save and download your Orcbrew files. Supported entries also appear in character creation, spell selection, and the compendium.
        </p>
      </div>
      <div>
        <input
          ref="fileInput"
          type="file"
          accept=".orcbrew,application/octet-stream,text/plain"
          class="hidden"
          @change="importFile"
        />
        <button class="btn-primary" :disabled="importing" @click="fileInput?.click()">
          {{ importing ? 'Importing…' : 'Import .orcbrew' }}
        </button>
      </div>
    </div>

    <p v-if="error" role="alert" class="text-sm text-[var(--site-danger)]">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm text-[var(--site-success)]">{{ notice }}</p>

    <div class="panel p-5">
      <div v-if="packs.length" class="compendium-pack-filters">
        <label>Filename<input v-model="packSearch" class="input-base" placeholder="Search saved files…" /></label>
        <label>Contains<select v-model="contentKind" class="input-base"><option value="">Any content type</option><option v-for="kind in contentKinds" :key="kind" :value="kind">{{kind.replace(/-/g,' ')}}</option></select></label>
        <p role="status">{{visiblePacks.length}} of {{packs.length}} files</p>
        <button v-if="packSearch||contentKind" type="button" class="btn-ghost text-sm" @click="packSearch='';contentKind=''">Clear file filters</button>
      </div>
      <p v-if="loading" class="text-sm text-[var(--color-ink-soft)]">Loading saved files…</p>
      <p v-else-if="packs.length === 0" class="text-sm text-[var(--color-ink-soft)]">
        No Orcbrew files saved yet. Import one to keep a copy in your account.
      </p>
      <p v-else-if="!visiblePacks.length" class="text-sm">No matching files. Try another filename or clear the file filters.</p>
      <ul v-else class="divide-y divide-[var(--cb-line)]">
        <li v-for="pack in visiblePacks" :key="pack.id" class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ pack.filename }}</p>
            <p class="text-xs text-[var(--color-ink-soft)]">
              {{ pack.report?.entryCount ?? 0 }} distinct definitions in {{ pack.report?.packCount ?? 0 }} packs · source file kept intact
            </p>
            <p class="text-xs mt-1">{{ countsText(pack) }}</p>
            <p v-if="pack.report?.duplicateCount" class="text-xs mt-1">{{ pack.report.duplicateCount }} identical definitions merged in this file.</p>
            <p v-for="warning in pack.report?.warnings ?? []" :key="warning" class="text-xs text-amber-200 mt-1">{{ warning }}</p>
            <p v-if="pack.error" class="text-xs text-[var(--site-danger)] mt-1" role="alert">{{ pack.error }}</p>
            <label v-if="pack.report?.disabledCount" class="flex gap-2 items-center text-xs mt-2">
              <input type="checkbox" :checked="pack.includeDisabled" :disabled="changingPack === pack.id" @change="toggleDisabled(pack, $event)" />
              Include {{ pack.report.disabledCount }} definitions marked disabled in the source
            </label>
          </div>
          <div class="flex gap-2">
            <button class="btn-ghost text-sm" @click="exportPack(pack)">Export</button>
            <button class="btn-ghost text-sm" @click="deletePack(pack)">Remove</button>
          </div>
        </li>
      </ul>
    </div>

    <p class="text-xs text-[var(--color-ink-soft)]">
      Single packs and pack collections are supported. Identical definitions merge across files; different versions keep their source labels. Advanced rule fields remain available for reference and in the original export.
    </p>
  </section>
</template>
