<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useBuilderAppearance } from '../../composables/useBuilderAppearance'

const auth = useAuthStore()
const router = useRouter()
const { appearanceOpen } = useBuilderAppearance()


async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="site-nav cb-builder-chrome px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-6">
      <RouterLink to="/" class="font-display text-xl text-[var(--color-gold-soft)]">
        Codex of Heroes
      </RouterLink>
      <nav v-if="auth.user" class="flex gap-4 text-sm">
        <RouterLink to="/" class="hover:text-[var(--color-gold-soft)]">Dashboard</RouterLink>
        <RouterLink to="/rooms" class="hover:text-[var(--color-gold-soft)]">Game rooms</RouterLink>
        <RouterLink to="/compendium" class="hover:text-[var(--color-gold-soft)]">Compendium</RouterLink>
        <RouterLink to="/homebrew" class="hover:text-[var(--color-gold-soft)]">Homebrew Workshop</RouterLink>
      </nav>
    </div>
    <div class="flex items-center gap-4 text-sm">
      <span v-if="auth.user" class="site-user-name text-[var(--color-ink-soft)]">{{ auth.user?.displayName }}</span>
      <button id="site-appearance-toggle" class="btn-ghost" :aria-expanded="appearanceOpen" aria-controls="builder-appearance" @click="appearanceOpen = !appearanceOpen">◐ Appearance</button>
      <button v-if="auth.user" class="btn-ghost" @click="onLogout">Log out</button>
    </div>
  </header>
</template>
