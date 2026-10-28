<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore, type EquipmentItem } from '../../stores/characters'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { armourValues, coinType, equipmentAttacks, inventoryKind, type InventoryKind } from '../../lib/equipment'
import { sheetAC, signed } from '../../lib/character-sheet'
import ItemRules from './ItemRules.vue'
import SheetListGroup from './SheetListGroup.vue'
import ItemComposer from '../items/DeferredItemComposer.vue'
import { attunementError,itemActive,itemBonuses } from '../../../shared/item-rules'
import { itemSearchText } from '../../lib/item-search'

const store = useCharactersStore(), c = computed(() => store.current!), library = useSheetLibrary()
const filter = ref('all'), query = ref(''), sort = ref('name')
const createOpen=ref(false),itemNotice=ref('')
const hydrated = computed(() => c.value.equipment.map(saved => {const detail=library.items.value[saved._id??saved.name];return {...detail,...saved,weapon:saved.weapon??detail?.weapon,armor:saved.armor??detail?.armor,description:saved.description||detail?.description,referenceDescription:saved.referenceDescription??detail?.referenceDescription}}))
const profile = computed(() => ({ ...c.value, equipment: hydrated.value }))
const items = computed(() => hydrated.value.map((item, index) => ({ item, index, kind: inventoryKind(item, c.value), attacks: equipmentAttacks(profile.value, item), armour: armourValues(profile.value, item, index) })))
const definitions: { kind: InventoryKind; title: string; equipped?: boolean }[] = [
  { kind: 'weapon', equipped: true, title: 'Equipped weapons' },
  { kind: 'armour', equipped: true, title: 'Equipped armour & shields' },
  { kind:'accessory',equipped:true,title:'Equipped accessories & magic items' },
  { kind:'consumable',title:'Potions, scrolls & consumables' },
  { kind: 'treasure', title: 'Treasure & currency' },
  { kind: 'weapon', equipped: false, title: 'Carried weapons' },
  { kind: 'armour', equipped: false, title: 'Carried armour & shields' },
  { kind:'accessory',equipped:false,title:'Carried accessories & magic items' },
  { kind: 'gear', equipped: true, title: 'Equipped gear' },
  { kind: 'gear', equipped: false, title: 'Carried gear' },
]
const groups = computed(() => definitions.map(group => ({ ...group, items: items.value.filter(row => {
  const equipped = row.kind !== 'treasure' && row.item.equipped
  return row.kind === group.kind && (group.equipped === undefined || equipped === group.equipped)
    && (filter.value === 'all' || (filter.value === 'equipped' ? equipped : !equipped))
    && `${itemSearchText(row.item)} ${row.item.notes}`.toLowerCase().includes(query.value.toLowerCase())
}).sort((a,b) => sort.value === 'weight' ? b.item.weight*b.item.qty-a.item.weight*a.item.qty : sort.value === 'quantity' ? b.item.qty-a.item.qty : a.item.name.localeCompare(b.item.name)) })).filter(group => group.items.length))
const weight = computed(() => items.value.reduce((sum,row) => sum+row.item.weight*row.item.qty,0))
const balances = computed(() => {
  const coins = new Map<string,number>()
  for (const row of items.value) { const key = coinType(row.item); if (key) coins.set(key,(coins.get(key)??0)+row.item.qty) }
  return [...coins.entries()]
})
async function update(index:number, patch:Partial<EquipmentItem>) {
  if (store.saving) return
  const row = items.value[index]!, next = { ...row.item, ...patch }
  const equipment=c.value.equipment.map((saved,i) => {
    if (i === index) return next
    const other = hydrated.value[i]!
    return patch.equipped && next.armor && other.armor && next.armor.shield === other.armor.shield ? { ...other, equipped:false } : saved
  })
  if(patch.attuned){const issue=attunementError(equipment);if(issue){store.saveError=issue;return}}
  try { await store.update(c.value._id, { equipment }) } catch { /* The sheet retains saved values and displays the error. */ }
}
function quantity(index:number, value:string) {
  const n = Number(value), row = items.value[index]!
  if (Number.isSafeInteger(n) && n >= 0) update(index, { qty:Math.min(row.kind === 'treasure' ? Number.MAX_SAFE_INTEGER : 9999,n), ...(n === 0 || row.kind === 'treasure' ? { equipped:false } : {}) })
}
</script>

<template>
  <div class="sheet-section-stack">
    <header class="sheet-section-title"><p class="sheet-eyebrow">PACKED FOR THE ROAD</p><h2>Equipment</h2><p>Weapons, armour, treasure, and other gear each have their own place. Your DM can create and give items here. Equipment and attunement control their active bonuses.</p></header>
    <p v-if="itemNotice" class="sheet-notice" role="status">{{itemNotice}}</p><button v-if="store.canEditPermanent" type="button" class="sheet-button sheet-button-primary" style="align-self:center" @click="createOpen=true">+ Add or create item · Give now</button><section class="sheet-panel"><div class="sheet-between" style="margin-bottom:12px"><h3 style="margin:0;text-align:left">Your inventory</h3><span class="sheet-small">{{items.length}} entries · {{weight.toFixed(1)}} lb. carried · Sheet AC {{sheetAC(profile)}}</span></div><div class="sheet-two-fields"><label>Search inventory<input v-model="query" type="search" placeholder="Name, category, or notes…" /></label><label>Sort by<select v-model="sort"><option value="name">Name · A–Z</option><option value="weight">Total weight · highest first</option><option value="quantity">Quantity · highest first</option></select></label></div><div class="sheet-filter-buttons" style="margin:12px 0"><button v-for="choice in [{value:'all',label:'All items'},{value:'equipped',label:'Equipped'},{value:'carried',label:'Carried'}]" :key="choice.value" class="sheet-button" :class="{active:filter===choice.value}" @click="filter=choice.value">{{choice.label}}</button></div><p class="sheet-small">Active item bonuses: {{signed(itemBonuses(profile).ac)}} AC · {{signed(itemBonuses(profile).saves)}} all saving throws. Attunements: {{hydrated.filter(i=>i.requiresAttunement&&i.attuned&&i.qty>0).length}} / 3.</p><p class="sheet-small">{{c.combat.acMode==='equipment'?'Sheet AC follows equipped armour and shields with known rules.':'Sheet AC uses your saved value. Armour totals below show known gear and ability modifiers; custom defenses may differ.'}}</p></section>
    <p v-if="!groups.length" class="sheet-empty">{{items.length?'No items match these filters.':'Your inventory is empty. Add SRD or custom items in Edit character.'}}</p>
    <SheetListGroup v-for="group in groups" :key="group.title" :title="group.title" :count="group.items.length" :group-key="`${c._id}:inventory:${group.title}`" :force-open="!!query.trim()||filter!=='all'" class="sheet-inventory-group">
      <div v-if="group.kind==='treasure'&&balances.length" class="sheet-coin-balances"><span v-for="[coin,total] in balances" :key="coin"><strong>{{total.toLocaleString()}}</strong> {{coin.toUpperCase()}}</span></div>
      <article v-for="row in group.items" :key="row.item._id??row.index" class="sheet-equipment-item"><div class="sheet-inventory-row"><div class="sheet-inventory-description"><details><summary>{{row.item.name}}</summary><div class="sheet-item-expanded"><p class="sheet-small">{{row.item.category??'Custom / imported item'}} · {{row.item.weight}} lb. each</p><ItemRules :item="row.item" /></div></details>
        <div v-if="row.kind==='weapon'" class="sheet-item-profile"><div v-for="(attack,index) in row.attacks" :key="index" class="sheet-weapon-profile"><span class="sheet-equipment-stat"><small>Attack roll</small><strong>d20 {{signed(attack.toHit)}}</strong></span><span class="sheet-equipment-stat"><small>Damage</small><strong>{{attack.text}} <span>{{attack.damageType}}</span></strong></span><span class="sheet-small">{{attack.ability.toUpperCase()}} · {{attack.proficient?'Proficient':'Not proficient'}}{{attack.range?` · ${attack.range}`:''}}</span></div><p v-if="!row.attacks.length" class="sheet-small">Attack rules are not recorded. Add a weapon attack in Edit character.</p></div>
        <div v-else-if="row.kind==='armour'" class="sheet-item-profile"><div v-if="row.armour" class="sheet-armour-profile"><span class="sheet-equipment-stat"><small>{{row.armour.shield?'Shield base':'Base AC'}}</small><strong>{{row.armour.shield?signed(row.armour.base):row.armour.base}}</strong></span><span v-if="!row.armour.shield" class="sheet-equipment-stat"><small>With abilities</small><strong>{{row.armour.itemAC}}</strong></span><span class="sheet-equipment-stat"><small>{{row.item.equipped?'Worn gear AC':'Gear AC if worn'}}</small><strong>{{row.armour.total}}</strong></span><span class="sheet-small">{{row.armour.shield?'Adds to your armour':`Dexterity ${signed(row.armour.dex)}`}}{{row.armour.magic?` · Enchantment ${signed(row.armour.magic)}`:''}}{{row.item.armor?.cap!==undefined?` · DEX cap +${row.item.armor.cap}`:''}}</span></div><p v-else class="sheet-small">Armour rules are not recorded. Sheet AC is {{sheetAC(profile)}}.</p></div>
        <p v-if="row.item.requiresAttunement" class="sheet-small">{{itemActive(row.item)?'Attuned and equipped · bonuses active':row.item.attuned?'Attuned · equip to activate':'Requires attunement · magical bonuses inactive'}}</p><p class="sheet-small sheet-item-weight">{{group.kind==='treasure'?(coinType(row.item)?`${row.item.qty.toLocaleString()} ${coinType(row.item)?.toUpperCase()}`:'Treasure / valuables'):(row.item.category??'Custom / imported')}} · {{(row.item.qty*row.item.weight).toFixed(1)}} lb.</p>
      </div><fieldset :disabled="store.saving" class="sheet-inventory-controls"><label v-if="row.kind!=='treasure'" class="sheet-checkbox"><input type="checkbox" :checked="row.item.equipped" :disabled="row.item.qty<=0" :aria-label="`Equip ${row.item.name}`" @change="update(row.index,{equipped:!row.item.equipped})" /> Equipped</label><label v-if="row.item.requiresAttunement" class="sheet-checkbox"><input type="checkbox" :checked="row.item.attuned" :aria-label="`Attune ${row.item.name}`" @change="update(row.index,{attuned:!row.item.attuned})" /> Attuned</label><label class="sheet-item-quantity">{{coinType(row.item)?'Amount':'Quantity'}}<input :value="row.item.qty" type="number" min="0" :max="row.kind==='treasure'?Number.MAX_SAFE_INTEGER:9999" :aria-label="`${row.item.name} quantity`" @change="quantity(row.index,($event.target as HTMLInputElement).value)" /></label></fieldset></div></article>
    </SheetListGroup>
    <ItemComposer v-if="createOpen" mode="give" :character-id="c._id" :character-name="c.meta.name" @close="createOpen=false" @saved="itemNotice=$event" />
  </div>
</template>
