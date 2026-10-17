<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import { attackBonus, abilityMod, type AbilityKey } from '../../lib/calc'

const store = useCharactersStore()
const c = computed(() => store.current!)

function patchCombat(patch: Record<string, unknown>) {
  store.update(c.value._id, { combat: { ...c.value.combat, ...patch } })
}

function num(e: Event): number {
  return parseInt((e.target as HTMLInputElement).value, 10) || 0
}

const attacks = computed(() =>
  c.value.attacks.map((a) => {
    const abilityScore = c.value.abilities[a.ability as AbilityKey]
    const proficient = false // attacks are treated as custom; proficiency added via magicBonus/manual
    return {
      ...a,
      toHit: attackBonus(c.value.meta.level, abilityScore, proficient, a.magicBonus),
    }
  }),
)

function addAttack() {
  store.update(c.value._id, {
    attacks: [
      ...c.value.attacks,
      {
        name: 'New Attack',
        ability: 'str',
        range: 'Melee',
        damageDice: '1d8',
        damageBonus: 0,
        damageType: 'slashing',
        notes: '',
        magicBonus: 0,
      },
    ],
  })
}

function updateAttack(idx: number, patch: Record<string, unknown>) {
  const next = c.value.attacks.map((a, i) => (i === idx ? { ...a, ...patch } : a))
  store.update(c.value._id, { attacks: next })
}

function removeAttack(idx: number) {
  store.update(c.value._id, { attacks: c.value.attacks.filter((_, i) => i !== idx) })
}

function bumpDeath(kind: 'success' | 'failure', delta: number) {
  const key = kind === 'success' ? 'deathSavesSuccess' : 'deathSavesFailure'
  const next = Math.max(0, Math.min(3, c.value.combat[key] + delta))
  patchCombat({ [key]: next })
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Vitals -->
    <div class="panel p-5">
      <h3 class="font-display text-lg text-[var(--color-gold-soft)] mb-4">Vitals</h3>
      <div class="space-y-4">
        <div>
          <label class="label-micro block mb-1">Armor Class</label>
          <input
            :value="c.combat.ac"
            type="number"
            class="input-base font-display text-xl"
            @change="patchCombat({ ac: num($event) })"
          />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="label-micro block mb-1">Max HP</label>
            <input
              :value="c.combat.hpMax"
              type="number"
              class="input-base"
              @change="patchCombat({ hpMax: num($event) })"
            />
          </div>
          <div>
            <label class="label-micro block mb-1">Current</label>
            <input
              :value="c.combat.hpCurrent"
              type="number"
              class="input-base"
              @change="patchCombat({ hpCurrent: num($event) })"
            />
          </div>
          <div>
            <label class="label-micro block mb-1">Temp</label>
            <input
              :value="c.combat.hpTemp"
              type="number"
              class="input-base"
              @change="patchCombat({ hpTemp: num($event) })"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label-micro block mb-1">Speed</label>
            <input
              :value="c.combat.speed"
              type="number"
              class="input-base"
              @change="patchCombat({ speed: num($event) })"
            />
          </div>
          <div>
            <label class="label-micro block mb-1">Initiative</label>
            <input
              :value="abilityMod(c.abilities.dex)"
              type="number"
              class="input-base"
              disabled
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label-micro block mb-1">Hit Dice Total</label>
            <input
              :value="c.combat.hitDiceTotal"
              type="number"
              class="input-base"
              @change="patchCombat({ hitDiceTotal: num($event) })"
            />
          </div>
          <div>
            <label class="label-micro block mb-1">Hit Dice Used</label>
            <input
              :value="c.combat.hitDiceUsed"
              type="number"
              class="input-base"
              @change="patchCombat({ hitDiceUsed: num($event) })"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Death Saves -->
    <div class="panel p-5">
      <h3 class="font-display text-lg text-[var(--color-gold-soft)] mb-4">Death Saves</h3>
      <div class="space-y-6">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="label-micro">Successes</span>
            <div class="flex gap-1">
              <button
                v-for="i in 3"
                :key="i"
                class="w-6 h-6 rounded-full border border-[#4a3c2a]"
                :class="{ 'bg-[var(--color-forest)]': i <= c.combat.deathSavesSuccess }"
                @click="bumpDeath('success', i <= c.combat.deathSavesSuccess ? -1 : 1)"
              />
            </div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <span class="label-micro">Failures</span>
            <div class="flex gap-1">
              <button
                v-for="i in 3"
                :key="i"
                class="w-6 h-6 rounded-full border border-[#4a3c2a]"
                :class="{ 'bg-[var(--color-blood)]': i <= c.combat.deathSavesFailure }"
                @click="bumpDeath('failure', i <= c.combat.deathSavesFailure ? -1 : 1)"
              />
            </div>
          </div>
        </div>
        <button
          class="btn-ghost text-xs w-full"
          @click="patchCombat({ deathSavesSuccess: 0, deathSavesFailure: 0 })"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Attacks -->
    <div class="panel p-5 lg:col-span-3">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display text-lg text-[var(--color-gold-soft)]">Attacks</h3>
        <button class="btn-ghost text-xs" @click="addAttack">+ Add Attack</button>
      </div>

      <p v-if="!attacks.length" class="text-sm text-[var(--color-ink-soft)]">No attacks yet.</p>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left label-micro border-b border-[#3a2e22]">
              <th class="py-2 pr-3">Name</th>
              <th class="py-2 pr-3">Bonus</th>
              <th class="py-2 pr-3">Damage</th>
              <th class="py-2 pr-3">Range</th>
              <th class="py-2 pr-3">Type</th>
              <th class="py-2 pr-3">Magic</th>
              <th class="py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(a, idx) in attacks"
              :key="idx"
              class="border-b border-[#3a2e22] align-top"
            >
              <td class="py-2 pr-3">
                <input
                  :value="a.name"
                  class="input-base"
                  @change="updateAttack(idx, { name: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td class="py-2 pr-3 font-display text-lg">
                {{ a.toHit >= 0 ? '+' : '' }}{{ a.toHit }}
              </td>
              <td class="py-2 pr-3">
                <div class="flex gap-1">
                  <input
                    :value="a.damageDice"
                    class="input-base w-20"
                    placeholder="1d8"
                    @change="
                      updateAttack(idx, { damageDice: ($event.target as HTMLInputElement).value })
                    "
                  />
                  <input
                    :value="a.damageBonus"
                    type="number"
                    class="input-base w-16"
                    @change="
                      updateAttack(idx, { damageBonus: num($event) })
                    "
                  />
                </div>
              </td>
              <td class="py-2 pr-3">
                <input
                  :value="a.range"
                  class="input-base w-24"
                  @change="updateAttack(idx, { range: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td class="py-2 pr-3">
                <input
                  :value="a.damageType"
                  class="input-base w-28"
                  @change="
                    updateAttack(idx, { damageType: ($event.target as HTMLInputElement).value })
                  "
                />
              </td>
              <td class="py-2 pr-3">
                <input
                  :value="a.magicBonus"
                  type="number"
                  class="input-base w-16"
                  @change="updateAttack(idx, { magicBonus: num($event) })"
                />
              </td>
              <td class="py-2">
                <button
                  class="text-[var(--color-blood-soft)] text-xs"
                  @click="removeAttack(idx)"
                >
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
