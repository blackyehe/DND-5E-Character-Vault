import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'

export interface User {
  id: string
  email: string
  displayName: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initialized = ref(false)

  async function fetchMe() {
    try {
      user.value = await api.get<User>('/api/auth/me')
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(email: string, password: string) {
    user.value = await api.post<User>('/api/auth/login', { email, password })
  }

  async function register(email: string, password: string, displayName: string) {
    user.value = await api.post<User>('/api/auth/register', { email, password, displayName })
  }

  async function logout() {
    await api.post('/api/auth/logout')
    user.value = null
  }

  return { user, initialized, fetchMe, login, register, logout }
})
