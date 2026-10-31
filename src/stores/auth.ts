import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'
import { sheetReferenceCache } from '../lib/sheet-reference-cache'
import { clearCreationOptionsCache } from '../lib/creation-options-cache'
import {adoptLocalCompendiumOwner,clearLocalCompendium,suspendLocalCompendium} from '../lib/local-compendium-client'
import {clearPersistedSheetReferences} from '../lib/persisted-sheet-references'
import {adoptCompendiumDetails,clearCompendiumDetails,suspendCompendiumDetails} from '../lib/compendium-detail-cache'

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
      adoptLocalCompendiumOwner(user.value.id)
      adoptCompendiumDetails(user.value.id)
    } catch {
      user.value = null
    } finally {
      if(previousUser!==user.value?.id){
        sheetReferenceCache.clear()
        // Initial authentication must preserve this owner's persisted catalogue.
        // Its owner and revision are checked before any cached value is used.
        if(previousUser||!user.value){clearCreationOptionsCache();clearPersistedSheetReferences()}
        // A session expiry suspends access; a later verified login may reuse the
        // same owner's disk copy. Explicit logout still removes it below.
        if(!user.value){suspendLocalCompendium();suspendCompendiumDetails()}
      }
      initialized.value = true
    }
  }

  async function login(email: string, password: string) {
    suspendLocalCompendium()
    suspendCompendiumDetails()
    clearCreationOptionsCache()
    sheetReferenceCache.clear()
    clearPersistedSheetReferences()
    user.value = await api.post<User>('/api/auth/login', { email, password })
    adoptLocalCompendiumOwner(user.value.id)
    adoptCompendiumDetails(user.value.id)
  }

  async function register(email: string, password: string, displayName: string) {
    clearLocalCompendium()
    clearCompendiumDetails()
    clearCreationOptionsCache()
    sheetReferenceCache.clear()
    clearPersistedSheetReferences()
    user.value = await api.post<User>('/api/auth/register', { email, password, displayName })
    adoptCompendiumDetails(user.value.id)
  }

  async function logout() {
    await api.post('/api/auth/logout')
    clearLocalCompendium()
    clearCompendiumDetails()
    clearCreationOptionsCache()
    sheetReferenceCache.clear()
    clearPersistedSheetReferences()
    user.value = null
  }

  return { user, initialized, fetchMe, login, register, logout }
})
