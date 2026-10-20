import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from 'vue'

/** Separate stacks keep one column's disclosures from moving the other column. */
export function useIndependentColumns<T>(items: ComputedRef<T[]>, order: 'row'|'column' = 'row', minimumWidth:ComputedRef<number>=computed(()=>1051)) {
  const wide = ref(false)
  let media: MediaQueryList | undefined
  const update = () => { wide.value = media?.matches ?? false }
  const bind=()=>{
    media?.removeEventListener('change', update)
    media = window.matchMedia(`(min-width: ${minimumWidth.value}px)`)
    update()
    media.addEventListener('change', update)
  }
  onMounted(bind)
  watch(minimumWidth,()=>{if(media)bind()})
  onBeforeUnmount(() => media?.removeEventListener('change', update))
  return computed(() => {
    if(!wide.value||items.value.length<2)return [items.value]
    // Consecutive groups fill the left stack before continuing in the right.
    // Keep row order for features, whose existing side-by-side grouping differs.
    if(order==='column'){
      const middle=Math.ceil(items.value.length/2)
      return [items.value.slice(0,middle),items.value.slice(middle)]
    }
    return [items.value.filter((_,index)=>index%2===0),items.value.filter((_,index)=>index%2===1)]
  })
}
