import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue'

/** Separate stacks keep one column's disclosures from moving the other column. */
export function useIndependentColumns<T>(items: ComputedRef<T[]>) {
  const wide = ref(false)
  let media: MediaQueryList | undefined
  const update = () => { wide.value = media?.matches ?? false }
  onMounted(() => {
    media = window.matchMedia('(min-width: 1051px)')
    update()
    media.addEventListener('change', update)
  })
  onBeforeUnmount(() => media?.removeEventListener('change', update))
  return computed(() => wide.value && items.value.length > 1
    ? [items.value.filter((_, index) => index % 2 === 0), items.value.filter((_, index) => index % 2 === 1)]
    : [items.value])
}
