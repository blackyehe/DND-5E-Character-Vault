<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'

const store = useCharactersStore()
const c = computed(() => store.current!)

function patchPersonality(patch: Record<string, unknown>) {
  store.update(c.value._id, {
    personality: { ...c.value.personality, ...patch },
  })
}

function patchMeta(patch: Record<string, unknown>) {
  store.update(c.value._id, { meta: { ...c.value.meta, ...patch } })
}

function addFeature() {
  store.update(c.value._id, {
    features: [...c.value.features, { name: 'New Feature', description: '' }],
  })
}

function updateFeature(idx: number, patch: Record<string, unknown>) {
  const next = c.value.features.map((f, i) => (i === idx ? { ...f, ...patch } : f))
  store.update(c.value._id, { features: next })
}

function removeFeature(idx: number) {
  store.update(c.value._id, { features: c.value.features.filter((_, i) => i !== idx) })
}

const textareas = [
  { key: 'traits', label: 'Personality Traits' },
  { key: 'ideals', label: 'Ideals' },
  { key: 'bonds', label: 'Bonds' },
  { key: 'flaws', label: 'Flaws' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'backstory', label: 'Backstory' },
  { key: 'notes', label: 'Notes' },
] as const
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="panel p-5 lg:col-span-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div v-for="t in textareas" :key="t.key">
          <label class="label-micro block mb-1">{{ t.label }}</label>
          <textarea
            :value="c.personality[t.key]"
            rows="3"
            class="input-base resize-y"
            @input="
              patchPersonality({
                [t.key]: ($event.target as HTMLTextAreaElement).value,
              })
            "
          />
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label class="label-micro block mb-1">Alignment</label>
          <input
            :value="c.meta.alignment"
            class="input-base"
            @change="patchMeta({ alignment: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div>
          <label class="label-micro block mb-1">Background</label>
          <input
            :value="c.meta.background"
            class="input-base"
            @change="patchMeta({ background: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div>
          <label class="label-micro block mb-1">XP</label>
          <input
            :value="c.meta.xp"
            type="number"
            class="input-base"
            @change="patchMeta({ xp: parseInt(($event.target as HTMLInputElement).value, 10) || 0 })"
          />
        </div>
        <div>
          <label class="label-micro block mb-1">Subclass</label>
          <input
            :value="c.meta.subclass"
            class="input-base"
            @change="patchMeta({ subclass: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
    </div>

    <div class="panel p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display text-lg text-[var(--color-gold-soft)]">Features &amp; Traits</h3>
        <button class="btn-ghost text-xs" @click="addFeature">+ Add</button>
      </div>

      <p v-if="!c.features.length" class="text-sm text-[var(--color-ink-soft)]">
        No features recorded.
      </p>

      <ul v-else class="space-y-3">
        <li v-for="(f, idx) in c.features" :key="idx" class="bg-[#1e1811] border border-[#3a2e22] rounded p-3">
          <div class="flex items-center gap-2 mb-2">
            <input
              :value="f.name"
              class="input-base flex-1 font-display"
              @change="updateFeature(idx, { name: ($event.target as HTMLInputElement).value })"
            />
            <button class="text-[var(--color-blood-soft)] text-xs" @click="removeFeature(idx)">
              ✕
            </button>
          </div>
          <textarea
            :value="f.description"
            rows="3"
            class="input-base resize-y text-sm"
            @input="
              updateFeature(idx, { description: ($event.target as HTMLTextAreaElement).value })
            "
          />
        </li>
      </ul>
    </div>
  </div>
</template>
