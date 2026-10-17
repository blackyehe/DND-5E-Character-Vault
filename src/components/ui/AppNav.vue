<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const showChrome = computed(() => auth.user)

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header
    v-if="showChrome"
    class="border-b border-[#4a3c2a] bg-[#241c13] px-6 py-3 flex items-center justify-between"
  >
    <div class="flex items-center gap-6">
      <RouterLink to="/" class="font-display text-xl text-[var(--color-gold-soft)]">
        Codex of Heroes
      </RouterLink>
      <nav class="flex gap-4 text-sm">
        <RouterLink to="/" class="hover:text-[var(--color-gold-soft)]">Dashboard</RouterLink>
        <RouterLink to="/compendium" class="hover:text-[var(--color-gold-soft)]">Compendium</RouterLink>
      </nav>
    </div>
    <div class="flex items-center gap-4 text-sm">
      <span class="text-[var(--color-ink-soft)]">{{ auth.user?.displayName }}</span>
      <button class="btn-ghost" @click="onLogout">Log out</button>
    </div>
  </header>
</template>
