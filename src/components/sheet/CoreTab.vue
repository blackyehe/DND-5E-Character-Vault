<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import {
  ABILITY_KEYS,
  SKILL_ABILITY,
  abilityMod,
  saveMod,
  skillMod,
  passivePerception,
  type AbilityKey,
  type Proficiency,
} from '../../lib/calc'

const store = useCharactersStore()
const c = computed(() => store.current!)

const skills = computed(() =>
  Object.entries(SKILL_ABILITY).map(([name, ability]) => ({
    name,
    ability,
  })),
)

function setAbility(key: AbilityKey, value: string) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return
  store.update(c.value._id, {
    abilities: { ...c.value.abilities, [key]: n },
  })
}

function toggleSave(key: AbilityKey) {
  store.update(c.value._id, {
    saves: { ...c.value.saves, [key]: !c.value.saves[key] },
  })
}

function cycleSkill(name: string) {
  const order: Proficiency[] = ['none', 'prof', 'expert']
  const cur = c.value.skills[name] ?? 'none'
  const next = order[(order.indexOf(cur) + 1) % order.length]
  store.update(c.value._id, {
    skills: { ...c.value.skills, [name]: next },
  })
}

const passiveWis = computed(() =>
  passivePerception(c.value.meta.level, c.value.abilities.wis, c.value.skills.perception ?? 'none'),
)
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Abilities -->
    <div class="panel p-5 lg:col-span-1">
      <h3 class="font-display text-lg text-[var(--color-gold-soft)] mb-4">Abilities</h3>
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="key in ABILITY_KEYS"
          :key="key"
          class="bg-[#1e1811] border border-[#4a3c2a] rounded p-3 text-center"
        >
          <div class="label-micro">{{ key.toUpperCase() }}</div>
          <input
            :value="c.abilities[key]"
            type="number"
            class="w-full bg-transparent text-center font-display text-2xl outline-none"
            @change="setAbility(key, ($event.target as HTMLInputElement).value)"
          />
          <div class="text-sm text-[var(--color-gold)]">
            {{ abilityMod(c.abilities[key]) >= 0 ? '+' : '' }}{{ abilityMod(c.abilities[key]) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Saves + passive -->
    <div class="panel p-5">
      <h3 class="font-display text-lg text-[var(--color-gold-soft)] mb-4">Saving Throws</h3>
      <ul class="space-y-2">
        <li v-for="key in ABILITY_KEYS" :key="key" class="flex items-center gap-3">
          <button
            class="w-5 h-5 rounded border border-[#4a3c2a] flex items-center justify-center"
            :class="{ 'bg-[var(--color-gold)] border-[var(--color-gold)]': c.saves[key] }"
            @click="toggleSave(key)"
          >
            <span v-if="c.saves[key]" class="text-[#1e1811] text-xs">✓</span>
          </button>
          <span class="flex-1 capitalize">{{ key }}</span>
          <span class="font-display">
            {{ saveMod(c.meta.level, c.abilities[key], c.saves[key]) >= 0 ? '+' : ''
            }}{{ saveMod(c.meta.level, c.abilities[key], c.saves[key]) }}
          </span>
        </li>
      </ul>
      <div class="mt-6 pt-4 border-t border-[#3a2e22] flex justify-between">
        <span class="label-micro">Passive Perception</span>
        <span class="font-display text-lg">{{ passiveWis }}</span>
      </div>
      <div class="mt-2 flex justify-between items-center">
        <span class="label-micro">Inspiration</span>
        <button
          class="w-6 h-6 rounded-full border border-[#4a3c2a]"
          :class="{ 'bg-[var(--color-gold)]': c.combat.inspiration }"
          @click="
            store.update(c._id, {
              combat: { ...c.combat, inspiration: !c.combat.inspiration },
            })
          "
        />
      </div>
    </div>

    <!-- Skills -->
    <div class="panel p-5 lg:col-span-1">
      <h3 class="font-display text-lg text-[var(--color-gold-soft)] mb-4">Skills</h3>
      <ul class="space-y-1.5">
        <li
          v-for="s in skills"
          :key="s.name"
          class="flex items-center gap-2 text-sm cursor-pointer"
          @click="cycleSkill(s.name)"
        >
          <span
            class="w-4 h-4 rounded-full border border-[#4a3c2a] flex-shrink-0"
            :class="{
              'bg-[var(--color-gold)]': (c.skills[s.name] ?? 'none') === 'prof',
              'bg-[var(--color-blood)]': c.skills[s.name] === 'expert',
            }"
          />
          <span class="flex-1 capitalize">{{ s.name.replace(/([A-Z])/g, ' $1') }}</span>
          <span class="text-xs text-[var(--color-ink-soft)] uppercase w-8">{{ s.ability }}</span>
          <span class="w-10 text-right font-display">
            {{
              skillMod(c.meta.level, c.abilities[s.ability], c.skills[s.name] ?? 'none') >= 0
                ? '+'
                : ''
            }}{{ skillMod(c.meta.level, c.abilities[s.ability], c.skills[s.name] ?? 'none') }}
          </span>
        </li>
      </ul>
    </div>

    <!-- Proficiencies -->
    <div class="panel p-5 lg:col-span-3">
      <h3 class="font-display text-lg text-[var(--color-gold-soft)] mb-4">
        Proficiencies &amp; Languages
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
        <div v-for="(val, key) in c.proficiencies" :key="key">
          <div class="label-micro mb-2 capitalize">{{ key }}</div>
          <p class="text-[var(--color-parchment)] leading-relaxed">
            {{ (val as string[]).join(', ') || '—' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
