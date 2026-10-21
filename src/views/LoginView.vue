<script setup lang="ts">
import { ref } from 'vue'
import { vMotionPanel } from '../directives/siteMotion'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
    } else {
      await auth.register(email.value, password.value, displayName.value)
    }
    const next = typeof route.query.next === 'string' ? route.query.next : ''
    router.replace(next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/api') ? next : '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div v-motion-panel="mode" class="panel w-full max-w-md p-8">
      <h1 class="font-display text-3xl text-center text-[var(--color-gold-soft)] mb-1">
        Codex of Heroes
      </h1>
      <p class="text-center text-sm text-[var(--color-ink-soft)] mb-6">
        {{ mode === 'login' ? 'Welcome back, adventurer.' : 'Create your account.' }}
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <div v-if="mode === 'register'">
          <label class="label-micro block mb-1">Display name</label>
          <input v-model="displayName" class="input-base" required />
        </div>
        <div>
          <label class="label-micro block mb-1">Email</label>
          <input v-model="email" type="email" class="input-base" required />
        </div>
        <div>
          <label class="label-micro block mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            class="input-base"
            :minlength="mode === 'register' ? 8 : undefined"
            required
          />
        </div>

        <p v-if="error" class="text-[var(--color-blood-soft)] text-sm">{{ error }}</p>

        <button type="submit" class="btn-primary w-full" :disabled="busy">
          {{ busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Register' }}
        </button>
      </form>

      <p class="text-sm text-center mt-6 text-[var(--color-ink-soft)]">
        {{ mode === 'login' ? "Don't have an account?" : 'Already registered?' }}
        <button
          class="text-[var(--color-gold-soft)] underline ml-1"
          @click="mode = mode === 'login' ? 'register' : 'login'"
        >
          {{ mode === 'login' ? 'Register' : 'Log in' }}
        </button>
      </p>
    </div>
  </div>
</template>
