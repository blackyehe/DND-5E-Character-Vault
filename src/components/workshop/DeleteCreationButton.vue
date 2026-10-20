<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { onBeforeRouteLeave } from 'vue-router'
import { announceWorkshopChange, deleteCreation, type DeleteCreation } from '../../lib/workshop-trash'
const props = defineProps<{ target: DeleteCreation; label?: string }>()
const emit = defineEmits<{ deleted: [message: string] }>()
const auth = useAuthStore(), open = ref(false), busy = ref(false), error = ref(''), packId = ref(''), panel = ref<HTMLElement>(), trigger = ref<HTMLButtonElement>()
const explanation = computed(() => props.target.scope === 'draft' ? 'This removes only the draft on this device. Its saved pack version, if any, stays available.' : props.target.scope === 'record' ? 'Existing character items and monster action copies stay as they are. This creation will no longer appear in your library.' : 'This removes the saved definition from the selected pack. Characters keep their last saved rules, with a missing-source notice for review. Other pack entries stay available.')
function trap(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !panel.value) return
  const controls = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')], first = controls[0], last = controls.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
async function show() { error.value = ''; packId.value = props.target.scope === 'pack' ? props.target.packs[0]?.id ?? '' : ''; open.value = true; await nextTick(); panel.value?.focus() }
function close() { if (busy.value) return; open.value = false; trigger.value?.focus() }
async function remove() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { const result = await deleteCreation(props.target, auth.user?.id ?? 'local', packId.value); open.value = false; announceWorkshopChange(); emit('deleted', result.message) }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
function guard(event: BeforeUnloadEvent) { if (busy.value) { event.preventDefault(); event.returnValue = '' } }
watch(busy, value => value ? window.addEventListener('beforeunload', guard) : window.removeEventListener('beforeunload', guard))
onBeforeRouteLeave(() => !busy.value)
onUnmounted(() => window.removeEventListener('beforeunload', guard))
</script>
<template>
  <button ref="trigger" type="button" class="hw-text-button hw-delete-button" :aria-label="`${label || 'Delete'} ${target.name}`" @click="show">{{ label || 'Delete' }}</button>
  <Teleport to=".site-shell"><div v-if="open" class="hw-modal-backdrop hw-page hw-delete-dialog" @click.self="close"><section ref="panel" tabindex="-1" class="hw-modal hw-panel" role="dialog" aria-modal="true" aria-label="Delete creation" @keydown="trap" @keydown.esc="close">
    <h2>Delete {{ target.name }}?</h2><p>{{ explanation }}</p><p class="hw-callout">You can restore it from <strong>Recently deleted</strong>. Nothing is permanently erased.</p>
    <label v-if="target.scope === 'pack'">Delete from pack<select v-model="packId" :disabled="busy"><option v-for="pack in target.packs" :key="pack.id" :value="pack.id">{{ pack.filename }}</option></select></label>
    <p v-if="error" class="hw-alert" role="alert">{{ error }}</p><footer class="hw-actions"><button class="hw-button" :disabled="busy" @click="close">Keep creation</button><button class="hw-button hw-button-primary" :disabled="busy || target.scope === 'pack' && !packId" @click="remove">{{ busy ? 'Deleting…' : 'Delete creation' }}</button></footer>
  </section></div></Teleport>
</template>
