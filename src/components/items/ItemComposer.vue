<script setup lang="ts">
import { vMotionPanel } from '../../directives/siteMotion'
import { computed,nextTick,onMounted,reactive,ref,watch } from 'vue'
import type { EquipmentItem } from '../../../shared/character'
import { itemKind,itemKinds } from '../../../shared/item-rules'
import { equipmentFrom,magicEquipmentFrom } from '../../../shared/equipment-definitions'
import { srd,type SrdRef,type SrdMagicItem } from '../../lib/srd'
import { emptyItemFilters,itemSearchText,magicItemBases,magicWeaponTypes,magicArmourTypes,matchesEquipmentItem,matchesMagicItem,normalEquipmentSearch } from '../../lib/magic-item-filters'
import { armourCategories,equipmentTags,itemFormTags,itemRarities,titleCase } from '../../../shared/item-classification'
import { api } from '../../lib/api'
import { useCharactersStore } from '../../stores/characters'
import ItemRules from '../sheet/ItemRules.vue'
import ItemFilters from './ItemFilters.vue'
import '../sheet/sheet.css'
import '../sheet/sheet-details.css'

const props=defineProps<{mode:'draft'|'give'|'library';characterId?:string;characterName?:string;initial?:EquipmentItem;initialMagical?:boolean}>()
const emit=defineEmits<{close:[];add:[item:EquipmentItem];saved:[message:string]}>()
const store=useCharactersStore(),dialog=ref<HTMLDialogElement|null>(null)
const page=ref(props.mode==='library'?'create':'library'),source=ref('all'),query=ref(''),error=ref(''),loading=ref(false),busy=ref(false),chosen=ref(false)
const remember=ref(props.mode!=='draft'),requestId=ref(crypto.randomUUID()),base=ref('')
const templateId=ref(props.initial?.templateId??'')
const magicDetail=ref<SrdMagicItem|null>(null)
const entries=ref<(SrdRef&{source:'equipment'|'magic'|'mine';item?:EquipmentItem})[]>([])
const filters=ref(emptyItemFilters()),customBase=ref(''),baseRequest=ref(0)
const makeEmpty=():EquipmentItem=>({name:'',qty:1,weight:0,equipped:false,notes:'',description:'',kind:'gear',tags:[],magical:props.initialMagical??false,requiresAttunement:false,attuned:false,effects:{ac:0,saves:0},magicBonus:0})
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const item=reactive<EquipmentItem>({...makeEmpty(),...clone(props.initial??{})})
const labels:Record<string,string>={weapon:'Weapon',armour:'Armour or shield',accessory:'Ring, wondrous item or accessory',consumable:'Potion, scroll or consumable',treasure:'Treasure or currency',gear:'Adventuring gear'}
const matches=computed(()=>entries.value.filter(e=>{const definition=e.item??(e.source==='equipment'?normalEquipmentSearch[e.index]:undefined);return (source.value==='all'||source.value===e.source)&&(definition?itemSearchText(definition):e.name.toLowerCase()).includes(query.value.toLowerCase())&&
  (definition?matchesEquipmentItem(definition,filters.value):e.source==='magic'?matchesMagicItem(e.index,filters.value):!Object.values(filters.value).some(Boolean))}))
const customArmourBases=computed(()=>magicArmourTypes.filter(form=>!item.armor?.category||form.group.toLowerCase()===item.armor.category))
const customTags=computed({get:()=>equipmentTags(item).filter(tag=>!(itemFormTags as readonly string[]).includes(tag)).join(', '),set:(value:string)=>{item.tags=[...equipmentTags(item).filter(tag=>(itemFormTags as readonly string[]).includes(tag)),...value.split(',').map(tag=>tag.trim().toLowerCase()).filter(Boolean)].filter((tag,index,all)=>all.indexOf(tag)===index)}})
const baseOptions=computed(()=>magicDetail.value?magicItemBases(magicDetail.value.index):[])
const heading=computed(()=>props.mode==='library'?'Item Workshop':props.mode==='give'?`Give an item to ${props.characterName??'this character'}`:'Add or create an item')
const canSubmit=computed(()=>item.name.trim()&&Number.isSafeInteger(item.qty)&&item.qty>=1&&Number.isFinite(item.weight)&&item.weight>=0&&(!baseOptions.value.length||base.value)&&!busy.value&&(page.value==='create'||chosen.value))
const action=computed(()=>props.mode==='draft'?'Add to character draft':props.mode==='give'?'Give item now':templateId.value?'Save item & update characters':'Save to my item library')
function assign(value:EquipmentItem){
  for(const key of Object.keys(item))delete (item as unknown as Record<string,unknown>)[key]
  Object.assign(item,makeEmpty(),clone(value))
  item.kind=value.kind??itemKind(value);item.effects??={ac:0,saves:0};item.magicBonus??=0
  item.tags=equipmentTags(value)
  if(item.weapon?.category)item.weapon.category=item.weapon.category.toLowerCase()
  customBase.value=[...magicWeaponTypes,...magicArmourTypes].some(form=>form.index===value.index)?value.index??'':''
}
function create(magical:boolean){page.value='create';chosen.value=false;magicDetail.value=null;base.value='';templateId.value='';requestId.value=crypto.randomUUID();assign({...makeEmpty(),magical});remember.value=props.mode!=='draft';error.value=''}
watch(()=>item.kind,kind=>{
  if(kind==='weapon')item.weapon??={dice:'1d6',damageType:'slashing',range:'Melee',finesse:false,ranged:false,category:'simple'}
  else delete item.weapon
  if(kind==='armour')item.armor??={base:11,dex:true,shield:false}
  else delete item.armor
  if(kind==='treasure'){item.equipped=false;item.attuned=false}
})
function changeKind(){
  ++baseRequest.value;customBase.value='';delete item.index;delete item.magicIndex;delete item.referenceDescription
  item.category=item.kind==='weapon'?'Weapon':item.kind==='armour'?'Armor':item.kind==='accessory'?'Wondrous Items':item.kind==='consumable'?'Consumable':item.kind==='treasure'?'Treasure':'Adventuring Gear'
}
function changeArmourCategory(){
  if(!item.armor)return
  ++baseRequest.value;customBase.value='';delete item.index;delete item.referenceDescription
  const category=item.armor.category
  Object.assign(item.armor,{base:category==='heavy'?16:category==='medium'?12:category==='shield'?2:11,dex:category==='light'||category==='medium',shield:category==='shield',cap:category==='medium'?2:undefined})
}
async function setCustomBase(){
  const sequence=++baseRequest.value,index=customBase.value,kind=item.kind
  if(!index){delete item.index;delete item.referenceDescription;return}
  busy.value=true;error.value=''
  try{
    const definition=normalEquipmentSearch[index]?clone(normalEquipmentSearch[index]!):equipmentFrom(await srd.equipmentItem(index))
    if(sequence!==baseRequest.value||kind!==item.kind)return
    if(kind==='weapon'&&!definition.weapon)throw new Error('This weapon uses special rules. Choose custom weapon and record its rules in the description.')
    const previousValue=item.index?normalEquipmentSearch[item.index]?.value:undefined
    if(!item.magical&&(!item.value||JSON.stringify(item.value)===JSON.stringify(previousValue)))item.value=definition.value
    item.index=definition.index;item.weapon=definition.weapon;item.armor=definition.armor;item.weight=definition.weight
    item.referenceDescription=definition.referenceDescription??definition.description;item.category=definition.category
  }catch(e){customBase.value=item.index??'';error.value=e instanceof Error?e.message:'The base item could not load. Choose it again.'}finally{busy.value=false}
}
function toggleTag(tag:string,checked:boolean){item.tags=checked?[...new Set([...equipmentTags(item),tag])]:equipmentTags(item).filter(value=>value!==tag)}
watch(()=>item.requiresAttunement,value=>{if(!value)item.attuned=false})
watch(()=>item.armor?.shield,(shield,previous)=>{if(shield&&previous===false&&item.armor){if(item.armor.base===11)item.armor.base=2;item.armor.dex=false;delete item.armor.cap}})
async function load(){
  loading.value=true;error.value=''
  const result=await Promise.allSettled([srd.equipment(),srd.magicItems(),api.get<{id:string;item:EquipmentItem}[]>('/api/items')])
  entries.value=[]
  if(result[0].status==='fulfilled')entries.value.push(...result[0].value.map(e=>({...e,source:'equipment' as const})))
  if(result[1].status==='fulfilled')entries.value.push(...result[1].value.map(e=>({...e,source:'magic' as const})))
  if(result[2].status==='fulfilled')entries.value.push(...result[2].value.map(e=>({index:e.id,name:e.item.name,url:'',item:e.item,source:'mine' as const})))
  entries.value.sort((a,b)=>a.name.localeCompare(b.name));loading.value=false
  if(result.some(r=>r.status==='rejected'))error.value='Part of the library could not load. You can retry, or create an item directly.'
}
async function choose(entry:typeof entries.value[number]){
  busy.value=true;error.value='';magicDetail.value=null;base.value=''
  try{
    if(entry.source==='mine')assign({...entry.item!,qty:1,equipped:false,attuned:false})
    else if(entry.source==='equipment')assign(equipmentFrom(await srd.equipmentItem(entry.index)))
    else{magicDetail.value=await srd.magicItem(entry.index);assign(magicEquipmentFrom(magicDetail.value));if(baseOptions.value.length===1){base.value=baseOptions.value[0]!.index;await setBase()}}
    chosen.value=true;requestId.value=crypto.randomUUID();remember.value=false
  }catch(e){error.value=e instanceof Error?e.message:'Could not load this item.'}finally{busy.value=false}
}
async function setBase(){
  if(!magicDetail.value||!base.value)return
  busy.value=true;error.value=''
  try{const form=await srd.equipmentItem(base.value);assign(magicEquipmentFrom(magicDetail.value,form))}catch{error.value='The base item could not load. Choose it again.'}finally{busy.value=false}
}
async function submit(){
  if(!canSubmit.value)return
  busy.value=true;error.value=''
  const definition=JSON.parse(JSON.stringify(item)) as EquipmentItem
  delete definition._id;delete definition.grantId
  if(definition.kind!=='weapon')delete definition.weapon
  if(definition.kind!=='armour')delete definition.armor
  if(!definition.requiresAttunement)definition.attuned=false
  try{
    if(props.mode==='library'){
      const body={item:definition,requestId:requestId.value}
      const result=templateId.value?await api.put<{message:string}>(`/api/items/${templateId.value}`,body):await api.post<{id:string}>('/api/items',body)
      emit('saved','message' in result?result.message:`${definition.name} saved in your item library.`)
    }else if(props.mode==='give'){
      if(!props.characterId)throw new Error('Choose a character first.')
      const result=await store.giveItem(props.characterId,definition,requestId.value,page.value==='create'&&remember.value)
      emit('saved',result.message)
    }else{
      if(page.value==='create'&&remember.value){const saved=await api.post<{id:string}>('/api/items',{item:definition,requestId:requestId.value});definition.templateId=saved.id;definition.templateRevision=0}
      emit('add',definition)
    }
    emit('close')
  }catch(e){error.value=e instanceof Error?e.message:'The item could not be saved. Your work is still here.'}finally{busy.value=false}
}
onMounted(async()=>{await nextTick();dialog.value?.showModal();if(props.initial){assign(props.initial);chosen.value=true}else if(props.mode==='library')create(props.initialMagical??false);void load()})
</script>
<template>
  <Teleport to=".site-shell"><dialog ref="dialog" class="item-composer hero-sheet" :aria-label="heading" @cancel.prevent="!busy&&emit('close')"><header><div><p class="sheet-eyebrow">CREATE · SAVE · GIVE</p><h2>{{heading}}</h2><p class="sheet-small">{{mode==='draft'?'The item will stay in your draft until you Save character.':mode==='give'?'Giving saves immediately. The player’s open sheet updates automatically.':'Save reusable items here. Saved changes update copies already given to characters.'}}</p></div><button type="button" class="sheet-button" aria-label="Close item creator" :disabled="busy" @click="emit('close')">✕</button></header>
  <nav class="sheet-filter-buttons" aria-label="Item creator sections"><button type="button" :disabled="busy" class="sheet-button" :class="{active:page==='library'}" @click="page='library';error=''">Choose from library</button><button type="button" :disabled="busy" class="sheet-button" :class="{active:page==='create'&&!item.magical}" @click="create(false)">Create normal item</button><button type="button" :disabled="busy" class="sheet-button" :class="{active:page==='create'&&item.magical}" @click="create(true)">Create magic item</button></nav>
  <p v-if="error" class="sheet-alert" role="alert">{{error}}</p>
  <form v-motion-panel="page + String(item.magical)" class="item-composer-body" @submit.prevent="submit"><fieldset :disabled="busy"><section v-if="page==='library'" class="item-library"><div class="sheet-two-fields"><label>Search item library<input v-model="query" type="search" placeholder="For example: Ring of Protection" /></label><label>Item source<select v-model="source"><option value="all">All items</option><option value="mine">My Workshop items</option><option value="equipment">SRD normal equipment</option><option value="magic">SRD magic items</option></select></label></div><details class="sheet-details"><summary>Filter by type, tags, rarity or attunement</summary><ItemFilters v-model="filters" :extra-tags="entries.flatMap(e=>e.item?equipmentTags(e.item):[])" /></details><p v-if="loading" class="sheet-small" role="status">Loading items…</p><div class="item-result-list"><button v-for="entry in matches.slice(0,40)" :key="`${entry.source}:${entry.index}`" type="button" @click="choose(entry)"><strong>{{entry.name}}</strong><small>{{entry.source==='mine'?'My Workshop':entry.source==='magic'?'SRD magic item':'SRD equipment'}}</small></button></div><p class="sheet-small">{{matches.length}} matches{{matches.length>40?' · Showing 40; narrow your search.':''}}</p><button v-if="error" type="button" class="sheet-button" @click="load">Retry library</button></section>
  <section v-if="page==='create'||chosen" class="item-definition"><template v-if="page==='create'"><div class="sheet-two-fields"><label>Item name<input v-model="item.name" required maxlength="200" placeholder="Name your item" /></label><label>Item type<select v-model="item.kind" @change="changeKind"><option v-for="kind in itemKinds" :key="kind" :value="kind">{{labels[kind]}}</option></select></label></div><label class="sheet-checkbox"><input v-model="item.magical" type="checkbox" /> Magic item</label>
  <label v-if="item.kind==='weapon'">Base weapon type<select v-model="customBase" @change="setCustomBase"><option value="">Custom weapon · enter my own stats</option><option v-for="form in magicWeaponTypes" :key="form.index" :value="form.index">{{form.name}}</option></select></label>
  <div v-if="item.kind==='armour'&&item.armor" class="sheet-two-fields"><label>Armour category<select v-model="item.armor.category" @change="changeArmourCategory"><option :value="undefined">Custom armour</option><option v-for="group in armourCategories" :key="group" :value="group">{{titleCase(group)}}{{group==='shield'?'':' armour'}}</option></select></label><label>Base armour type<select v-model="customBase" @change="setCustomBase"><option value="">Custom armour · enter my own stats</option><option v-for="form in customArmourBases" :key="form.index" :value="form.index">{{form.name}}</option></select></label></div>
  <p v-if="item.kind==='weapon'||item.kind==='armour'" class="sheet-small">Choosing a base fills its standard rules and weight. You can customise the stats below; its type stays searchable.</p>
  <label v-if="item.kind==='accessory'">Accessory category<select v-model="item.category"><option>Wondrous Items</option><option>Ring</option><option>Rod</option><option>Staff</option><option>Wand</option></select></label><label v-if="item.kind==='consumable'">Consumable category<select v-model="item.category"><option>Consumable</option><option>Potion</option><option>Scroll</option><option>Ammunition</option></select></label>
  <label>Rules & description<textarea v-model="item.description" rows="4" maxlength="30000" placeholder="What does the item do? Record special, conditional and spell effects here." /></label>
  <details class="sheet-details" :open="item.kind==='accessory'"><summary>Item tags & details</summary><p class="sheet-small">Tags describe its physical form and help you find it. They do not impose equipment-slot limits.</p><div class="item-tag-choices"><label v-for="tag in itemFormTags" :key="tag" class="sheet-checkbox"><input type="checkbox" :checked="equipmentTags(item).includes(tag)" @change="toggleTag(tag,($event.target as HTMLInputElement).checked)" />{{titleCase(tag)}}</label></div><label>Other tags · separated by commas<input v-model.lazy="customTags" placeholder="For example: cursed, silvered, sentient" maxlength="600" /></label><div class="sheet-form-grid"><label>Rarity<select v-model="item.rarity"><option :value="undefined">Not specified</option><option v-for="rarity in itemRarities" :key="rarity" :value="rarity">{{titleCase(rarity)}}</option></select></label><label>Value each · optional<input :value="item.value?.amount" type="number" min="0" max="1000000000" step="0.01" placeholder="Not set" @input="item.value=($event.target as HTMLInputElement).value===''?undefined:{amount:Number(($event.target as HTMLInputElement).value),currency:item.value?.currency??'gp'}" /></label><label>Currency<select :value="item.value?.currency??'gp'" @change="item.value={amount:item.value?.amount??0,currency:($event.target as HTMLSelectElement).value as NonNullable<EquipmentItem['value']>['currency']}"><option v-for="currency in ['cp','sp','ep','gp','pp']" :key="currency" :value="currency">{{currency.toUpperCase()}}</option></select></label></div></details>
  <div v-if="item.kind==='weapon'&&item.weapon" class="sheet-form-grid"><label>Damage dice<input v-model="item.weapon.dice" required placeholder="1d8" pattern="[0-9]{1,2}[dD][0-9]{1,3}([+-][0-9]{1,3})?" /></label><label>Damage type<input v-model="item.weapon.damageType" required placeholder="Slashing" /></label><label>Range<input v-model="item.weapon.range" placeholder="Melee or 80/320 ft." /></label><label>Weapon training<select v-model="item.weapon.category"><option value="simple">Simple</option><option value="martial">Martial</option><option value="custom">Custom</option></select></label><label class="sheet-checkbox"><input v-model="item.weapon.noDamage" type="checkbox" /> No direct damage · special rules</label><label class="sheet-checkbox"><input v-model="item.weapon.finesse" type="checkbox" /> Finesse</label><label class="sheet-checkbox"><input v-model="item.weapon.ranged" type="checkbox" /> Ranged weapon</label></div>
  <div v-if="item.kind==='armour'&&item.armor" class="sheet-form-grid"><label>Base AC / shield bonus<input v-model.number="item.armor.base" type="number" min="0" max="40" required /></label><label class="sheet-checkbox"><input v-model="item.armor.dex" type="checkbox" /> Add Dexterity</label><label>Maximum Dexterity bonus<input v-model.number="item.armor.cap" type="number" min="0" max="20" placeholder="Blank = no cap" @change="item.armor.cap=($event.target as HTMLInputElement).value===''?undefined:item.armor.cap" /></label></div>
  <details v-if="customBase&&item.referenceDescription" class="sheet-details"><summary>Base item properties & rules</summary><ItemRules :item="{referenceDescription:item.referenceDescription}" /></details>
  <details class="sheet-details" :open="!!(item.effects?.ac||item.effects?.saves||item.magicBonus)"><summary>Automatic bonuses</summary><p class="sheet-small">These numeric bonuses apply while equipped, and attuned if required. Record conditional and other effects in the description.</p><div class="sheet-form-grid"><label v-if="item.kind==='weapon'||item.kind==='armour'">{{item.kind==='weapon'?'Attack & damage enchantment':'Armour enchantment'}}<input v-model.number="item.magicBonus" type="number" min="-20" max="20" /></label><label v-if="item.effects">Extra AC bonus<input v-model.number="item.effects.ac" type="number" min="-20" max="20" /></label><label v-if="item.effects">All saving throws bonus<input v-model.number="item.effects.saves" type="number" min="-20" max="20" /></label></div></details><label class="sheet-checkbox"><input v-model="item.requiresAttunement" type="checkbox" /> Requires attunement</label><label v-if="item.requiresAttunement">Attunement requirements · optional<input v-model="item.attunementRequirement" maxlength="500" placeholder="For example: by a spellcaster, or by a cleric of a specific deity" /><small class="sheet-small">Record eligibility here for the DM to check.</small></label><label v-if="mode!=='library'" class="sheet-checkbox"><input v-model="remember" type="checkbox" /> Save a reusable copy in my Workshop item library</label></template>
  <template v-else><h3>{{item.name}}</h3><p class="sheet-small">{{labels[item.kind??'gear']}} · {{item.magical?'Magic':'Normal'}}{{item.requiresAttunement?' · Requires attunement':''}}</p><label v-if="baseOptions.length">Choose base weapon or armour<select v-model="base" required @change="setBase"><option value="">Choose its physical form…</option><option v-for="form in baseOptions" :key="form.index" :value="form.index">{{form.name}}</option></select></label><details class="sheet-details" open><summary>Item rules & effects</summary><ItemRules :item="item" /></details><p v-if="item.effects?.ac||item.effects?.saves" class="sheet-notice">Automatic bonuses: {{item.effects?.ac??0}} AC · {{item.effects?.saves??0}} to all saving throws, while active.</p></template>
  <div class="sheet-two-fields"><label>Quantity<input v-model.number="item.qty" type="number" min="1" :max="item.kind==='treasure'?Number.MAX_SAFE_INTEGER:9999" required /></label><label v-if="page==='create'">Weight each · lb.<input v-model.number="item.weight" type="number" min="0" max="100000" step="0.01" required /></label></div><template v-if="mode!=='library'&&item.kind!=='treasure'"><label class="sheet-checkbox"><input v-model="item.equipped" type="checkbox" /> Equip immediately</label><label v-if="item.requiresAttunement" class="sheet-checkbox"><input v-model="item.attuned" type="checkbox" /> Already attuned</label><p v-if="item.requiresAttunement" class="sheet-small">Attunement normally takes a short rest. A character can attune to three items. Bonuses require both wearing and attunement.</p></template>
  </section></fieldset><footer><button type="button" class="sheet-button" :disabled="busy" @click="emit('close')">Cancel</button><button type="submit" class="sheet-button sheet-button-primary" :disabled="!canSubmit">{{busy?'Saving…':action}}</button></footer></form></dialog></Teleport>
</template>
<style>
.item-composer.hero-sheet{position:fixed;inset:0;margin:auto;padding:0;width:min(860px,calc(100vw - 24px));max-height:calc(100dvh - 24px);border:1px solid var(--cb-line);border-radius:10px;background:var(--cb-paper);color:var(--cb-ink);box-shadow:0 15px 60px #0008}.item-composer[open]{display:flex;flex-direction:column}.item-composer::backdrop{background:#000a}.item-composer>header{display:flex;align-items:start;justify-content:space-between;gap:14px;padding:18px 22px 12px;border-bottom:1px solid var(--cb-line)}.item-composer h2{font:25px Georgia,serif;margin:2px 0 8px}.item-composer>nav{padding:12px 20px;margin:0}.item-composer>.sheet-alert{margin:0 20px 10px}.item-composer-body{overflow:auto;min-height:0;padding:0 22px}.item-composer-body fieldset{display:grid;gap:18px}.item-composer-body label{margin:10px 0}.item-composer-body h3{font:22px Georgia,serif;margin:0 0 8px}.item-composer-body footer{position:sticky;bottom:0;display:flex;justify-content:end;gap:9px;padding:14px 0;margin-top:16px;background:var(--cb-paper);border-top:1px solid var(--cb-line)}.item-result-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:180px;overflow:auto;margin-top:8px}.item-result-list>button{padding:8px 10px;border:1px solid var(--cb-line);border-radius:5px;background:var(--cb-field);text-align:left;cursor:pointer}.item-result-list strong{font-size:13px;display:block;color:var(--cb-ink);font-weight:500}.item-result-list small{color:var(--cb-muted);font-size:10px}.item-result-list>button:hover{border-color:var(--cb-accent-mark)}.item-tag-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:0 10px}.item-tag-choices label.sheet-checkbox{margin:5px 0}.item-definition{border-top:1px solid var(--cb-line);padding-top:13px}
@media(max-width:560px){.item-composer>header,.item-composer-body{padding-inline:14px}.item-composer h2{font-size:21px}.item-result-list{grid-template-columns:1fr}}
</style>
