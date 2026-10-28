<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, ref } from 'vue'
import type { EquipmentItem } from '../../../shared/character'
import type ItemComposer from './ItemComposer.vue'
import type { ItemComposerProps } from './item-composer-props'

defineOptions({ inheritAttrs: false })
const props = defineProps<ItemComposerProps>()
const emit = defineEmits<{ close: []; add: [item: EquipmentItem]; saved: [message: string]; change: [item: EquipmentItem] }>()
const composer = shallowRef<typeof ItemComposer>(), failed = ref(false)
let disposed = false
onMounted(async () => {
  try {
    const loaded = await import('./ItemComposer.vue')
    if (!disposed) composer.value = loaded.default
  } catch { if (!disposed) failed.value = true }
})
onUnmounted(() => { disposed = true })
</script>

<template>
  <component v-if="composer" :is="composer" v-bind="{ ...$attrs, ...props }" @close="emit('close')" @add="emit('add', $event)" @saved="emit('saved', $event)" @change="emit('change', $event)" />
  <section v-else class="sheet-panel" :role="failed ? 'alert' : 'status'">
    <p>{{ failed ? 'The item creator could not load. Reload the page to try again.' : 'Loading item creator…' }}</p>
    <button type="button" class="sheet-button" @click="emit('close')">Cancel</button>
  </section>
</template>
