import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'
import { sheetReferenceCache } from '../lib/sheet-reference-cache'
import { clearCreationOptionsCache } from '../lib/creation-options-cache'
import {clearLocalCompendium} from '../lib/local-compendium-client'

export interface User {
  id: string
  email: string
  displayName: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initialized = ref(false)

  async function fetchMe() {
    const previousUser=user.value?.id
    try {
      user.value = await api.get<User>('/api/auth/me')
    } catch {
      user.value = null
    } finally {
      if(previousUser!==user.value?.id){
        sheetReferenceCache.clear()
        // Initial authentication must preserve this owner's persisted catalogue.
        // Its owner and revision are checked before any cached value is used.
        if(previousUser||!user.value){clearCreationOptionsCache();clearLocalCompendium()}
      }
      initialized.value = true
    }
  }

  async function login(email: string, password: string) {
    clearLocalCompendium()
    clearCreationOptionsCache()
    sheetReferenceCache.clear()
    user.value = await api.post<User>('/api/auth/login', { email, password })
  }

  async function register(email: string, password: string, displayName: string) {
    clearLocalCompendium()
    clearCreationOptionsCache()
    sheetReferenceCache.clear()
    user.value = await api.post<User>('/api/auth/register', { email, password, displayName })
  }

  async function logout() {
    await api.post('/api/auth/logout')
    clearLocalCompendium()
    clearCreationOptionsCache()
    sheetReferenceCache.clear()
    user.value = null
  }

  return { user, initialized, fetchMe, login, register, logout }
})
