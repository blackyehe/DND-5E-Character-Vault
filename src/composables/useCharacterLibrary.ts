import { computed, ref } from 'vue'
import { api, ApiError } from '../lib/api'
import { emptyLibrary, folderLabel, type CharacterLibrary, type LibraryAction } from '../../shared/character-library'

export function useCharacterLibrary() {
  const library = ref(emptyLibrary()), loading = ref(true), saving = ref(false), error = ref(''), notice = ref(''), ready = ref(false)
  const placements = computed(() => new Map(library.value.placements.map(p => [p.characterId, p.folderId])))
  const folderOf = (id: string) => placements.value.get(id) ?? null
  const labelOf = (id: string) => folderLabel(library.value.folders, folderOf(id))
  let generation = 0
  async function load() {
    const run = ++generation; loading.value = true; error.value = ''
    try { const result = await api.get<CharacterLibrary>('/api/character-library'); if (run === generation) { library.value = result; ready.value = true } }
    catch (e) { if (run === generation) error.value = e instanceof Error ? e.message : 'Your folders could not be loaded.' }
    finally { if (run === generation) loading.value = false }
  }
  async function change(action: LibraryAction) {
    if (saving.value || loading.value || !ready.value) return false
    saving.value = true; error.value = ''; notice.value = ''; generation++
    try {
      library.value = await api.patch<CharacterLibrary>('/api/character-library', { expectedRevision: library.value.revision, action })
      notice.value = action.type === 'move' ? `${action.characterIds.length === 1 ? 'Character moved' : `${action.characterIds.length} characters moved`}.` : 'Folders saved.'
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The change could not be saved.'
      if (e instanceof ApiError && e.status === 409) await load()
      error.value = message
      return false
    } finally { saving.value = false }
  }
  return { library, loading, saving, error, notice, ready, locked: computed(() => loading.value || saving.value || !ready.value), load, change, folderOf, labelOf }
}
