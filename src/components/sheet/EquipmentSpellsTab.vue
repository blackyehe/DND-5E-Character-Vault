<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import { srd } from '../../lib/srd'
import { skillMod } from '../../lib/calc'
import SpellPicker from '../pickers/SpellPicker.vue'

const store = useCharactersStore()
const c = computed(() => store.current!)

const showSpellPicker = ref(false)

function patchSpellcasting(patch: Record<string, unknown>) {
  store.update(c.value._id, {
    spellcasting: { ...c.value.spellcasting, ...patch },
  })
}

function num(e: Event): number {
  return parseInt((e.target as HTMLInputElement).value, 10) || 0
}

const spellAbility = computed(() => c.value.spellcasting.ability as keyof typeof c.value.abilities)

const spellAttack = computed(() =>
  skillMod(c.value.meta.level, c.value.abilities[spellAbility.value], 'prof'),
)

const spellDC = computed(() => 8 + spellAttack.value)

const totalWeight = computed(() =>
  c.value.equipment.reduce((sum, e) => sum + (e.weight || 0) * (e.qty || 0), 0),
)

function addEquipment() {
  store.update(c.value._id, {
    equipment: [
      ...c.value.equipment,
      { name: 'New Item', qty: 1, weight: 0, equipped: false, notes: '' },
    ],
  })
}

function updateEquipment(idx: number, patch: Record<string, unknown>) {
  const next = c.value.equipment.map((e, i) => (i === idx ? { ...e, ...patch } : e))
  store.update(c.value._id, { equipment: next })
}

function removeEquipment(idx: number) {
  store.update(c.value._id, { equipment: c.value.equipment.filter((_, i) => i !== idx) })
}

async function addAsAttack(idx: number) {
  const item = c.value.equipment[idx]
  try {
    const detail = await srd.equipmentItem(item.name.toLowerCase().replace(/\s+/g, '-'))
    store.update(c.value._id, {
      attacks: [
        ...c.value.attacks,
        {
          name: detail.name,
          ability: 'str',
          range: detail.weapon_range ?? 'Melee',
          damageDice: detail.damage?.damage_dice ?? '',
          damageBonus: 0,
          damageType: detail.damage?.damage_type?.name ?? '',
          notes: '',
          magicBonus: 0,
        },
      ],
    })
  } catch {
    alert('Could not look up that item in the SRD.')
  }
}

function togglePrepared(index: string) {
  const prepared = c.value.spellcasting.prepared
  const next = prepared.includes(index)
    ? prepared.filter((p) => p !== index)
    : [...prepared, index]
  patchSpellcasting({ prepared: next })
}

function removePrepared(index: string) {
  patchSpellcasting({ prepared: c.value.spellcasting.prepared.filter((p) => p !== index) })
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="panel p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display text-lg text-[var(--color-gold-soft)]">Equipment</h3>
        <button class="btn-ghost text-xs" @click="addEquipment">+ Add</button>
      </div>

      <p class="text-xs text-[var(--color-ink-soft)] mb-3">
        Carried weight: {{ totalWeight.toFixed(1) }} lb
      </p>

      <p v-if="!c.equipment.length" class="text-sm text-[var(--color-ink-soft)]">Empty pack.</p>

      <ul v-else class="space-y-2">
        <li
          v-for="(e, idx) in c.equipment"
          :key="idx"
          class="flex items-center gap-2 bg-[#1e1811] border border-[#3a2e22] rounded p-2"
        >
          <input
            :checked="e.equipped"
            type="checkbox"
            class="accent-[var(--color-gold)]"
            @change="
              updateEquipment(idx, { equipped: ($event.target as HTMLInputElement).checked })
            "
          />
          <input
            :value="e.name"
            class="input-base flex-1"
            @change="updateEquipment(idx, { name: ($event.target as HTMLInputElement).value })"
          />
          <input
            :value="e.qty"
            type="number"
            class="input-base w-16"
            @change="updateEquipment(idx, { qty: num($event) })"
          />
          <input
            :value="e.weight"
            type="number"
            step="0.1"
            class="input-base w-16"
            @change="updateEquipment(idx, { weight: num($event) })"
          />
          <button class="btn-ghost text-xs" title="Add as attack" @click="addAsAttack(idx)">
            ⚔
          </button>
          <button class="text-[var(--color-blood-soft)] text-xs" @click="removeEquipment(idx)">
            ✕
          </button>
        </li>
      </ul>
    </div>

    <div class="panel p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display text-lg text-[var(--color-gold-soft)]">Spellcasting</h3>
        <button class="btn-ghost text-xs" @click="showSpellPicker = true">+ Add Spell</button>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-4">
        <div>
          <label class="label-micro block mb-1">Ability</label>
          <select
            :value="c.spellcasting.ability"
            class="input-base"
            @change="
              patchSpellcasting({ ability: ($event.target as HTMLSelectElement).value })
            "
          >
            <option value="int">Intelligence</option>
            <option value="wis">Wisdom</option>
            <option value="cha">Charisma</option>
          </select>
        </div>
        <div>
          <label class="label-micro block mb-1">Spell Attack</label>
          <input class="input-base font-display text-lg" :value="`+${spellAttack}`" disabled />
        </div>
        <div>
          <label class="label-micro block mb-1">Save DC</label>
          <input class="input-base font-display text-lg" :value="spellDC" disabled />
        </div>
      </div>

      <p v-if="!c.spellcasting.prepared.length" class="text-sm text-[var(--color-ink-soft)]">
        No spells prepared.
      </p>

      <ul v-else class="space-y-2">
        <li
          v-for="index in c.spellcasting.prepared"
          :key="index"
          class="flex items-center justify-between bg-[#1e1811] border border-[#3a2e22] rounded p-2 text-sm"
        >
          <span class="capitalize">{{ index.replace(/-/g, ' ') }}</span>
          <button class="text-[var(--color-blood-soft)] text-xs" @click="removePrepared(index)">
            Remove
          </button>
        </li>
      </ul>

      <SpellPicker
        v-if="showSpellPicker"
        @close="showSpellPicker = false"
        @pick="
          togglePrepared($event);
          showSpellPicker = false
        "
      />
    </div>
  </div>
</template>
