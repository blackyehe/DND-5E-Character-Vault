import { classSpellDefaults } from '../../shared/class-rules'
import { resolveCharacterProgression, slotMaximums, suggestedProgression } from '../../shared/character-progression'
import { automaticResources } from '../../shared/character-resources'
import { emptyCharacter, type Character } from '../../shared/character'
import { compactWeaponProficiencies } from '../../shared/weapon-proficiencies'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod, type AbilityKey } from '../../shared/calc'
import { readSrdRule } from './srd-client'
import { readEdn } from './edn'
import { resolveEquipmentItem } from './equipment-references'
type Data = Record<string, unknown>
interface Choice { key: string; value: unknown; selections: Selection[]; homebrew: boolean }
interface Selection { key: string; options: Choice[]; homebrew: boolean }
export interface ImportCatalog { [kind: string]: Data[] }
export interface DmvPreview { character: Omit<Character, '_id' | 'updatedAt'>; warnings: string[]; matchedSpells: number; unresolvedSpells: string[]; sourceUrl: string }
export class DmvImportError extends Error {
  constructor(message: string, publicStatus = 400) { super(message); this.status = publicStatus }
  status: number
}
const MAX_BYTES = 4 * 1024 * 1024
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {}
const local = (key: string) => key.replace(/^:/, '').replace(/^.*\//, '')
const field = (value: unknown, key: string): unknown => Object.entries(object(value)).find(([name]) => local(name) === key)?.[1]
const text = (value: unknown) => typeof value === 'string' ? value : ''
const label = (key: string) => local(key).replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim()
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const integer = (value: unknown, fallback: number, min = 0, max = 100000) => finite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
export function dmvCharacterUrl(input: string) {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new DmvImportError('Enter a complete Dungeon Master’s Vault character link.') }
  const match = url.pathname.match(/^\/(?:pages\/)?dnd\/5e\/characters\/(\d{1,20})\/?$/)
  if (!['https:', 'http:'].includes(url.protocol) || !['www.dungeonmastersvault.com', 'dungeonmastersvault.com'].includes(url.hostname.toLowerCase()) || url.port || url.username || url.password || !match) {
    throw new DmvImportError('Use a Dungeon Master’s Vault character link, such as https://www.dungeonmastersvault.com/pages/dnd/5e/characters/12345.')
  }
  return { sourceUrl: `https://www.dungeonmastersvault.com/pages/dnd/5e/characters/${match[1]}`, dataUrl: `https://www.dungeonmastersvault.com/dnd/5e/characters/${match[1]}` }
}
export async function fetchDmvCharacter(input: string) {
  const { sourceUrl, dataUrl } = dmvCharacterUrl(input)
  try {
    // Only this fixed public host/path is fetched. No credentials or redirects are forwarded.
    const response = await fetch(dataUrl, { headers: { Accept: 'application/edn, application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new DmvImportError('That character is not publicly available. Check the link or upload its character data instead.', response.status === 404 || response.status === 403 ? 422 : 502)
    if (/text\/html/i.test(response.headers.get('content-type') ?? '')) throw new DmvImportError('The source returned a web page instead of character data. Try a character data file instead.', 502)
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new DmvImportError('The character data exceeds the 4 MB import limit.') }
    const chunks: Uint8Array[] = []
    let size = 0
    if (!response.body) throw new DmvImportError('The source returned no character data.', 502)
    const reader = response.body.getReader()
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > MAX_BYTES) { await reader.cancel(); throw new DmvImportError('The character data exceeds the 4 MB import limit.') }
        chunks.push(part.value)
      }
    } finally { reader.releaseLock() }
    return { source: Buffer.concat(chunks).toString('utf8'), sourceUrl }
  } catch (error) {
    if (error instanceof DmvImportError) throw error
    throw new DmvImportError('Dungeon Master’s Vault could not be reached. Try again, or upload character data instead.', 502)
  }
}
function parseCharacter(source: string) {
  if (Buffer.byteLength(source, 'utf8') > MAX_BYTES) throw new DmvImportError('Character data must be 4 MB or smaller.')
  const clean = source.replace(/^\uFEFF/, '').trim()
  let parsed: unknown
  try { parsed = JSON.parse(clean) } catch {
    try { parsed = readEdn(clean) } catch { throw new DmvImportError('This is not readable character data. Upload EDN or JSON character data, not a PDF or homebrew pack.') }
  }
  const root = object(field(parsed, 'character') ?? parsed)
  if (!Object.keys(root).some((key) => /orcpub\.(entity|dnd\.e5\.character)/.test(key))) throw new DmvImportError('No Dungeon Master’s Vault character was found in this data.')
  return root
}
function normalizeSelections(value: unknown, depth = 0, budget = { nodes: 0 }): Selection[] {
  if (depth > 40 || ++budget.nodes > 20000) throw new DmvImportError('This character has too many nested selections to import safely.')
  const strict = field(value, 'selections')
  const loose = object(field(value, 'options'))
  const selections = Array.isArray(strict) ? strict : Object.entries(loose).map(([key, choice]) => ({ key, options: Array.isArray(choice) ? choice : [choice] }))
  return selections.map((raw) => {
    const homebrew = field(raw, 'homebrew?') === true
    const single = field(raw, 'option')
    return { key: local(text(field(raw, 'key'))), homebrew, options: (single ? [single] : list(field(raw, 'options'))).map((option): Choice => ({
      key: local(text(field(option, 'key'))), homebrew: homebrew || field(option, 'homebrew?') === true,
      value: field(option, 'map-value') ?? field(option, 'int-value') ?? field(option, 'string-value') ?? field(option, 'value'),
      selections: normalizeSelections(option, depth + 1, budget),
    })) }
  })
}
function flatten(selections: Selection[]): Selection[] { return selections.flatMap((selection) => [selection, ...selection.options.flatMap((option) => flatten(option.selections))]) }
const skillKey = (key: string) => local(key).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
export async function previewDmvCharacter(source: string, sourceUrl: string, catalog: ImportCatalog = {}, srdBase = 'http://localhost:3000/api/2014'): Promise<DmvPreview> {
  const raw = parseCharacter(source)
  const selections = normalizeSelections(raw)
  const all = flatten(selections)
  const values = object(field(raw, 'values'))
  const summary = object(field(raw, 'summary'))
  const character = emptyCharacter()
  const warnings = new Set<string>()
  const unresolvedSpells: string[] = []
  const find = (key: string) => selections.find((selection) => selection.key === key)
  const first = (key: string) => find(key)?.options[0]
  const sourceNames = new Set<string>()
  const requests = new Map<string, Promise<Data | null>>()
  async function srd(kind: string, key: string) {
    if (!/^[a-z0-9-]+$/i.test(key)) return null
    const path = `${kind}/${key}`
    if (!requests.has(path)) requests.set(path, readSrdRule(srdBase,path).then(value=>value?object(value):null).catch(() => { warnings.add(`The rules entry ${path} could not be loaded. Review its imported details.`); return null }))
    return requests.get(path)!
  }
  async function resolve(kind: string, choice: Choice) {
    let custom = (catalog[kind] ?? []).filter((entry) => local(text(entry.contentKey)) === choice.key || text(entry.name).toLowerCase() === label(choice.key).toLowerCase())
    // The user selected these original, 2014-era sources when reviewing ambiguous imports.
    const preferredSpellSources:Record<string,string>={gust:"Xanathar's Guide to Everything",'summon-undead':"Tasha's Cauldron of Everything"}
    if(kind==='spells'&&preferredSpellSources[choice.key]){
      const preferred=custom.filter(entry=>text(entry.sourcePack)===preferredSpellSources[choice.key]&&local(text(entry.contentKey))===choice.key)
      if(preferred.length===1)custom=preferred
    }
    if (choice.homebrew) {
      if (custom.length === 1) { sourceNames.add(text(custom[0]!.sourcePack)); return custom[0]! }
      if (custom.length > 1 && choice.homebrew) { warnings.add(`Several imported definitions match ${label(choice.key)}. Choose its source manually.`); return null }
    }
    const aliases:Record<string,string> = kind==='subclasses'?{'college-of-lore':'lore','college-of-valor':'valor','school-of-evocation':'evocation'}:{}
    const standard = await srd(kind, aliases[choice.key]??choice.key)
    if (standard) return standard
    if (custom.length === 1) { sourceNames.add(text(custom[0]!.sourcePack)); return custom[0]! }
    return null
  }
  character.meta.name = text(field(values, 'character-name')) || text(field(summary, 'character-name'))
  if (!character.meta.name.trim()) throw new DmvImportError('The source contains no named character. Check that this is a public character link.')
  character.meta.name = character.meta.name.slice(0, 200)
  character.meta.xp = integer(field(values, 'xps'), 0)
  character.meta.portrait = /^https?:\/\//i.test(text(field(values, 'image-url'))) ? text(field(values, 'image-url')) : ''
  character.meta.alignment = label(first('alignment')?.key ?? text(field(values, 'alignment')))
  const classChoices = find('class')?.options ?? []
  const classSummaries = list(field(summary, 'classes')).map(object)
  const classRecords = await Promise.all(classChoices.map((choice) => resolve('classes', choice)))
  const classLevels = classChoices.map((choice, index) => {
    const levels = choice.selections.find((selection) => selection.key === 'levels')?.options ?? []
    return integer(field(classSummaries[index], 'level'), levels.length || 1, 1, 20)
  })
  const totalLevel = classLevels.reduce((sum, level) => sum + level, 0) || classSummaries.reduce((sum, record) => sum + integer(field(record, 'level'), 0, 0, 20), 0)
  character.meta.level = integer(totalLevel, 1, 1, 20)
  if (!totalLevel) warnings.add('The character level was missing. Review the level before importing.')
  if (totalLevel > 20) warnings.add('The source level exceeds the site’s level 20 limit. Its original class levels are preserved in the source.')
  character.meta.klass = classChoices.map((choice, index) => text(classRecords[index]?.name) || text(field(classSummaries[index], 'class-name')) || label(choice.key)).join(' / ') || classSummaries.map((entry) => text(field(entry, 'class-name'))).join(' / ')
  character.meta.classLevels=classChoices.map((choice,index)=>({name:text(classRecords[index]?.name)||label(choice.key),level:classLevels[index]!}))
  character.meta.subclass = classSummaries.map((entry) => text(field(entry, 'subclass-name'))).filter(Boolean).join(' / ')
  const subclassChoices = all.filter((selection) => /origin|subclass|archetype|college|domain|patron|tradition|circle|oath/.test(selection.key)).flatMap((selection) => selection.options)
  const subclassRecords = await Promise.all(subclassChoices.map((choice) => resolve('subclasses', choice)))
  subclassChoices.forEach((choice, index) => { if (!subclassRecords[index]) warnings.add(`No matching subclass definition was found for ${label(choice.key)}. Its original selections are preserved.`) })
    if (classChoices.length > 1) warnings.add('Multiclass levels are preserved. Review combined spell slots, class-specific resources, and hit dice manually.')
  const raceChoice = first('race')
  const race = raceChoice ? await resolve('races', raceChoice) : null
  const raceSelections = raceChoice ? flatten(raceChoice.selections) : []
  const subraceChoice = raceSelections.find((selection) => selection.key === 'subrace')?.options[0]
  const subrace = subraceChoice && subraceChoice.key !== 'custom' ? await resolve('subraces', subraceChoice) : null
  character.meta.race = text(field(summary, 'race-name')) || text(race?.name) || label(raceChoice?.key ?? '')
  character.meta.subrace = text(field(summary, 'subrace-name')) || text(subrace?.name) || (subraceChoice?.key === 'custom' ? 'Custom' : label(subraceChoice?.key ?? ''))
  character.meta.background = label(first('background')?.key ?? '')
  const abilityChoice = first('ability-scores')
  const abilityMap = object(abilityChoice?.value ?? field(values, 'abilities'))
  const missingAbilities: string[] = []
  for (const key of ABILITY_KEYS) {
    const score = field(abilityMap, key)
    if (!finite(score)) missingAbilities.push(key.toUpperCase())
    character.abilities[key] = integer(score, 10, 1, 35)
  }
  if (missingAbilities.length) warnings.add(`No base score was supplied for ${missingAbilities.join(', ')}. Placeholder scores of 10 need review.`)
  for (const selection of all.filter((entry) => entry.key === 'asi')) for (const choice of selection.options) {
    const key = choice.key as AbilityKey
    if (ABILITY_KEYS.includes(key)) character.abilities[key] += integer(choice.value, 1, 0, 10)
  }
  const featChoices=[...new Map(all.filter(s=>s.key==='feats'||s.key==='feat').flatMap(s=>s.options).map(choice=>[choice.key,choice])).values()]
  const featRecords=await Promise.all(featChoices.map(choice=>resolve('feats',choice)))
  for(const feat of featRecords){
    const increases=list(feat?.ability_increases)
    if(increases.length===1){const ability=local(text(field(increases[0],'name')??increases[0])) as AbilityKey;if(ABILITY_KEYS.includes(ability))character.abilities[ability]++}
  }
  const customRace = subraceChoice?.key === 'custom' || raceSelections.some((entry) => entry.key === 'variant')
  for (const entry of [...(!customRace ? list(race?.ability_bonuses) : []), ...list(subrace?.ability_bonuses)]) {
    const key = text(field(entry, 'ability_score') && object(field(entry, 'ability_score')).index) as AbilityKey
    if (ABILITY_KEYS.includes(key)) character.abilities[key] += integer(field(entry, 'bonus'), 0, 0, 10)
  }
  for (const key of ABILITY_KEYS) character.abilities[key] = integer(character.abilities[key], 10, 1, 35)
  for (const selection of all) {
    if (/skill.*prof|proficiency.*skill/.test(selection.key) || /skill.*expert/.test(selection.key)) for (const choice of selection.options) {
      const key = skillKey(choice.key)
      if (key in SKILL_ABILITY) character.skills[key] = /expert/.test(selection.key) || character.skills[key] === 'expert' ? 'expert' : 'prof'
    }
    if (/language/.test(selection.key)) character.proficiencies.languages.push(...selection.options.map((choice) => label(choice.key)))
    if (/tool-prof/.test(selection.key)) character.proficiencies.tools.push(...selection.options.map((choice) => label(choice.key)))
    if (/armor-prof/.test(selection.key)) character.proficiencies.armor.push(...selection.options.map((choice) => label(choice.key)))
    if (/weapon-prof/.test(selection.key)) character.proficiencies.weapons.push(...selection.options.map((choice) => label(choice.key)))
  }
  character.proficiencies.languages.push(...list(race?.languages).map((entry) => text(field(entry, 'name'))))
  for (const save of list(classRecords[0]?.saving_throws)) {
    const key = text(field(save, 'index')) as AbilityKey
    if (ABILITY_KEYS.includes(key)) character.saves[key] = true
  }
  for (const proficiency of list(classRecords[0]?.proficiencies)) {
    const name = text(field(proficiency, 'name'))
    if (!name || /^(skill-|saving-throw-)/.test(text(field(proficiency, 'index')))) continue
    if (/armor|shield/i.test(name)) character.proficiencies.armor.push(name)
    else if (/weapon|sword|bow|dagger|sling|club|axe|staff|mace|spear|dart|hammer|rapier|scimitar/i.test(name)) character.proficiencies.weapons.push(name)
    else character.proficiencies.tools.push(name)
  }
  for (const group of Object.keys(character.proficiencies) as (keyof Character['proficiencies'])[]) character.proficiencies[group] = [...new Set(character.proficiencies[group].filter(Boolean))]
  const background = first('background') ? await resolve('backgrounds', first('background')!) : null
  for (const proficiency of list(background?.starting_proficiencies)) {
    const key = skillKey(text(field(proficiency, 'index')).replace(/^skill-/, ''))
    if (key in SKILL_ABILITY && !character.skills[key]) character.skills[key] = 'prof'
  }
  let baseHp = 0
  classChoices.forEach((choice, index) => {
    const die = integer(classRecords[index]?.hit_die, 6, 1, 100)
    const levels = choice.selections.find((selection) => selection.key === 'levels')?.options ?? []
    if (!classRecords[index]) warnings.add(`Class rules for ${label(choice.key)} were unavailable. Its hit-point estimate needs review.`)
    for (let level = 0; level < classLevels[index]!; level++) {
      const gain = levels[level]?.selections.find((entry) => entry.key === 'hit-points')?.options[0]?.value
      baseHp += finite(gain) ? integer(gain, 1, 1, 1000) : index === 0 && level === 0 ? die : Math.floor(die / 2) + 1
    }
  })
  const hpEstimate = Math.max(1, baseHp + abilityMod(character.abilities.con) * character.meta.level + (featRecords.some(f=>text(f?.name).toLowerCase()==='tough')?2*character.meta.level:0))
  character.combat.hpMax = integer(field(values, 'max-hit-points'), hpEstimate, 1)
  character.combat.hpCurrent = integer(field(values, 'current-hit-points'), character.combat.hpMax, 0, character.combat.hpMax)
  character.combat.hpTemp = integer(field(values, 'temporary-hit-points'), 0)
  character.combat.hitDiceTotal = character.meta.level
  character.combat.speed = integer(field(values, 'speed'), integer(race?.speed, 30), 0, 10000)
  const worn = local(text(field(values, 'worn-armor')))
  const shield = local(text(field(values, 'wielded-shield')))
  const mainHand=local(text(field(values,'main-hand-weapon'))),offHand=local(text(field(values,'off-hand-weapon')))
  let armorBase = 10 + abilityMod(character.abilities.dex)
  for (const kind of ['equipment', 'weapons', 'armor', 'magic-weapons', 'magic-armor', 'magic-items', 'other-magic-items', 'treasure']) {
    const inventory = find(kind)?.options ?? []
    for (const choice of inventory) {
      const quantity = integer(field(choice.value, 'quantity'), 1, 1, 100000)
      const magic = kind.startsWith('magic-') ? choice.key.match(/^(.+)-([123])$/) : null
      const magicBonus = magic ? Number(magic[2]) : choice.key==='scimitar-of-speed'?2:0
      const specialBases:Record<string,string>={'staff-of-fire':'quarterstaff','scimitar-of-speed':'scimitar','sword-of-sharpness-scimitar':'scimitar'}
      const equipmentKey = specialBases[choice.key] ?? magic?.[1] ?? choice.key
      const armorAliases: Record<string, string> = { padded: 'padded-armor', leather: 'leather-armor', 'studded-leather': 'studded-leather-armor', hide: 'hide-armor', 'half-plate': 'half-plate-armor', splint: 'splint-armor', plate: 'plate-armor' }
      const gear = kind === 'treasure' ? null : await srd('equipment', armorAliases[equipmentKey] ?? equipmentKey)
      const magicDetail = kind.includes('magic') ? await srd('magic-items',choice.key==='sword-of-sharpness-scimitar'?'sword-of-sharpness':choice.key) : null
      const equipped = field(choice.value, 'equipped?') === true || [worn,shield,mainHand,offHand].includes(choice.key)
      const name = magicDetail ? text(magicDetail.name)+(choice.key==='sword-of-sharpness-scimitar'?' · Scimitar':'') : gear ? `${text(gear.name)}${magicBonus ? ` +${magicBonus}` : ''}` : label(choice.key)
      const armor=object(gear?.armor_class)
      character.equipment.push({ name, qty: quantity, weight: finite(gear?.weight) ? gear.weight : 0, equipped, magicBonus, index:gear?text(gear.index):undefined, category:text(field(gear?.equipment_category??magicDetail?.equipment_category,'name'))||undefined, description:list(magicDetail?.desc??gear?.desc).map(text).join('\n\n'),
        ...(gear?.armor_class?{armor:{base:integer(armor.base,0),dex:armor.dex_bonus===true,cap:finite(armor.max_bonus)?armor.max_bonus:undefined,shield:gear.armor_category==='Shield'}}:{}),
        ...(gear?.damage?{weapon:{dice:text(field(gear.damage,'damage_dice')),damageType:text(field(field(gear.damage,'damage_type'),'name')),range:text(gear.weapon_range),finesse:list(gear.properties).some(p=>field(p,'index')==='finesse'),ranged:gear.weapon_range==='Ranged',category:text(gear.weapon_category)}}:{}),
        notes: kind === 'treasure' ? 'Currency / treasure imported from Dungeon Master’s Vault.' : !gear ? 'Imported item: check weight and special effects.' : magicBonus ? `Magic bonus +${magicBonus}. Review any other special effects.` : '' })
      if (choice.key==='staff-of-fire'||choice.key==='ring-of-evasion') {
        (character.resources??=[]).push({id:`item:${choice.key}`,name:`${name} charges`,max:choice.key==='staff-of-fire'?10:3,used:0,recovery:'manual',notes:choice.key==='staff-of-fire'?'At dawn recover 1d6 + 4 spent charges, up to 10. Burning Hands: 1; Fireball: 3; Wall of Fire: 4. Roll d20 if the last charge is spent; on 1 the staff is destroyed.':'At dawn recover 1d3 spent charges, up to 3. Spend 1 as a reaction to succeed on a failed Dexterity save.'})
      }
      if (gear?.damage) {
        const finesse = list(gear.properties).some((property) => field(property, 'index') === 'finesse')
        const ability: AbilityKey = gear.weapon_range === 'Ranged' || (finesse && character.abilities.dex > character.abilities.str) ? 'dex' : 'str'
        character.attacks.push({ name, ability, range: text(gear.weapon_range), damageDice: text(field(gear.damage, 'damage_dice')), damageBonus: 0, damageType: text(field(field(gear.damage, 'damage_type'), 'name')), notes: 'Imported weapon; review class features and special effects.', magicBonus })
      }
      if (choice.key === worn && gear?.armor_class) {
        const ac = object(gear.armor_class)
        armorBase = integer(ac.base, 10) + magicBonus + (ac.dex_bonus ? Math.min(abilityMod(character.abilities.dex), finite(ac.max_bonus) ? ac.max_bonus : Infinity) : 0)
      }
    }
  }
  if (shield && shield !== 'none') armorBase += 2
  if(character.equipment.some(i=>i.equipped&&i.name==='Ring of Protection'))armorBase++
  if(featRecords.some(f=>text(f?.name)==='Dual Wielder')&&mainHand&&mainHand!=='none'&&offHand&&offHand!=='none')armorBase++
  for(const selection of all.filter(entry=>entry.key.startsWith('starting-equipment-')))for(const choice of selection.options){
    const key=choice.key,gear=await srd('equipment',key)
    if(!gear||character.equipment.some(item=>item.index===text(gear.index)))continue
    const equipped=[mainHand,offHand,worn,shield].includes(key),armor=object(gear.armor_class)
    character.equipment.push({name:text(gear.name),index:text(gear.index),qty:integer(field(choice.value,'quantity'),1,1,1000),weight:finite(gear.weight)?gear.weight:0,equipped,notes:'Imported class starting equipment.',category:text(field(gear.equipment_category,'name')),description:list(gear.desc).map(text).join('\n\n'),
      ...(gear.armor_class?{armor:{base:integer(armor.base,0),dex:armor.dex_bonus===true,cap:finite(armor.max_bonus)?armor.max_bonus:undefined,shield:gear.armor_category==='Shield'}}:{}),
      ...(gear.damage?{weapon:{dice:text(field(gear.damage,'damage_dice')),damageType:text(field(field(gear.damage,'damage_type'),'name')),range:text(gear.weapon_range),finesse:list(gear.properties).some(p=>field(p,'index')==='finesse'),ranged:gear.weapon_range==='Ranged',category:text(gear.weapon_category)}}:{})})
    if(equipped&&gear.damage){const finesse=list(gear.properties).some(p=>field(p,'index')==='finesse');character.attacks.push({name:text(gear.name),ability:gear.weapon_range==='Ranged'||finesse&&character.abilities.dex>character.abilities.str?'dex':'str',range:text(gear.weapon_range),damageDice:text(field(gear.damage,'damage_dice')),damageBonus:0,damageType:text(field(field(gear.damage,'damage_type'),'name')),notes:'Imported class starting weapon.',magicBonus:0})}
  }
  character.combat.ac = integer(field(values, 'armor-class'), armorBase, 1, 1000)
  const spellSelections = all.filter((selection) => /cantrip|spells?-(known|prepared)|^(spells|level-\d+-spell|book-of-ancient-secrets-rituals|magical-secrets)$/.test(selection.key))
  const preparedByClass=list(field(values,'prepared-spells-by-class')).flatMap(entry=>list(field(entry,'prepared-spells')).map(key=>({key:local(text(key)),value:undefined,selections:[],homebrew:false} as Choice)))
  const grantedSpells:Choice[]=[]
  for(const [index,record] of classRecords.entries())for(const modifier of list(object(record?.details)[':level-modifiers'])){
    if(field(modifier,'type')!==':spell'||integer(field(modifier,'level'),1,1,20)>classLevels[index]!)continue
    const key=local(text(field(field(modifier,'value'),'key')))
    if(key)grantedSpells.push({key,value:undefined,selections:[],homebrew:false})
  }
  for(const record of subclassRecords){
    const details=object(record?.details),paladinIndex=classChoices.findIndex(choice=>choice.key==='paladin')
    if(paladinIndex<0)continue
    const slots=slotMaximums('half',classLevels[paladinIndex]!)
    const highest=Math.max(0,...Object.entries(slots).filter(([,max])=>max>0).map(([key])=>Number(key.slice(1))))
    for(const [rank,spells] of Object.entries(object(details[':paladin-spells'])))if(Number(rank)<=highest){
      for(const value of Object.values(object(spells))){const key=local(text(value));if(key)grantedSpells.push({key,value:undefined,selections:[],homebrew:false})}
    }
  }
  const spellChoices = [...new Map([...grantedSpells,...preparedByClass,...spellSelections.flatMap((selection) => selection.options)].map((choice) => [choice.key, choice])).values()]
  for (const choice of spellChoices) {
    const spell = await resolve('spells', choice)
    if (spell?.index) { character.spellcasting.known.push(text(spell.index)); character.spellcasting.prepared.push(text(spell.index)) }
    else unresolvedSpells.push(label(choice.key))
  }
  if (unresolvedSpells.length) warnings.add(`These spells need a matching definition: ${unresolvedSpells.join(', ')}. Their names and selections are preserved below.`)
  const defaults=classChoices.length===1?classSpellDefaults(character.meta.classLevels?.[0]?.name??''):undefined
  if(defaults)character.spellcasting.slotRule={progression:defaults.progression,className:character.meta.classLevels![0]!.name}
  const casting = object(classRecords[0]?.spellcasting)
  const customCasting = object(object(classRecords[0]?.details)[':spellcasting'])
  const ability = text(defaults?.ability || field(casting.spellcasting_ability, 'index') || customCasting[':ability']).replace(/^:/, '').replace(/^.*\//, '') as AbilityKey
  character.spellcasting.ability = ABILITY_KEYS.includes(ability) ? ability : 'int'
  for (let level = 1; level <= 9; level++) character.spellcasting.slots[`l${level}`] = { max: 0, used: 0 }
  for (const [index, choice] of classChoices.entries()) {
    if (!/^[a-z0-9-]+$/i.test(choice.key)) continue
    for (let level = 1; level <= classLevels[index]!; level++) {
      const progression = await srd(`classes/${choice.key}/levels`, String(level))
      if (level === classLevels[index] && classChoices.length === 1) {
        const slots = object(progression?.spellcasting)
        for (let rank = 1; rank <= 9; rank++) character.spellcasting.slots[`l${rank}`] = { max: integer(slots[`spell_slots_level_${rank}`], 0, 0, 99), used: 0 }
      }
      for (const reference of list(progression?.features)) {
        const feature = await srd('features', text(field(reference, 'index')))
        if (feature) character.features.push({ name: text(feature.name), description: list(feature.desc).map(text).join('\n\n'),origin:'class',level })
      }
    }
  }
  if(classChoices.length>1){
    let casterLevel=0
    for(const [i,choice] of classChoices.entries())if(['bard','cleric','druid','sorcerer','wizard'].includes(choice.key))casterLevel+=classLevels[i]!;else if(['paladin','ranger'].includes(choice.key))casterLevel+=Math.floor(classLevels[i]!/2)
    const maxima=slotMaximums('full',casterLevel)
    for(let rank=1;rank<=9;rank++)character.spellcasting.slots[`l${rank}`]={max:maxima[`l${rank}`]!,used:0,recovery:'long'}
    const warlock=classChoices.findIndex(c=>c.key==='warlock')
    if(warlock>=0){const pact=slotMaximums('pact',classLevels[warlock]!);for(const [key,max] of Object.entries(pact))if(max){
      if(character.spellcasting.slots[key]!.max===0)character.spellcasting.slots[key]={max,used:0,recovery:'short'}
      else (character.resources??=[]).push({id:`pact:${key}`,name:`Pact slots · spell level ${key.slice(1)}`,max,used:0,recovery:'short'})
    }}
  }
  for (const record of subclassRecords) {
    if (!record?.subclass_levels || !/^[a-z0-9-]+$/i.test(text(record.index))) continue
    const ownerClass=text(field(record.class,'index'))
    const classIndex=classChoices.findIndex(choice=>choice.key===ownerClass)
    const levelLimit=classIndex>=0?classLevels[classIndex]!:character.meta.level
    const progression=await readSrdRule(srdBase,`subclasses/${text(record.index)}/levels`).catch(()=>{warnings.add(`Subclass features for ${text(record.name)} could not be loaded.`);return []})
    for(const entry of list(progression).filter(entry=>integer(field(entry,'level'),99)<=levelLimit))for(const reference of list(field(entry,'features'))){
      const feature=await srd('features',text(field(reference,'index')))
      if(feature)character.features.push({name:text(feature.name),description:list(feature.desc).map(text).join('\n\n'),origin:'subclass',level:integer(field(entry,'level'),1,1,20)})
    }
  }
  for (const key of Object.keys(character.personality) as (keyof Character['personality'])[]) {
    const aliases = { traits: ['personality-traits', 'traits'], ideals: ['ideals'], bonds: ['bonds'], flaws: ['flaws'], appearance: ['description', 'appearance'], backstory: ['backstory'], notes: ['notes'] }[key]
    character.personality[key] = aliases.map((name) => text(field(values, name))).find(Boolean) ?? ''
  }
  const featureKeys = /^(asi|ability-scores|levels|class|race|subrace|variant|equipment|weapons|armor|treasure|magic-weapons|magic-armor|magic-items|other-magic-items|hit-points|alignment|background)$/
  for(const detail of featRecords){if(detail)character.features.push({name:text(detail.name),description:text(detail.description)||list(detail.desc).map(text).join('\n\n'),origin:'feat'})}
  for (const selection of all.filter((entry) => !featureKeys.test(entry.key) && entry.options.length)) {
    character.features.push({ name: label(selection.key), description: selection.options.map((choice) => label(choice.key)).join(', ').slice(0, 20000) })
  }
  for (const item of [race, subrace, ...classRecords, ...subclassRecords, background]) for (const trait of list(item?.homebrew_traits ?? item?.traits ?? item?.racial_traits)) {
    const origin=item===race||item===subrace?'racial':classRecords.includes(item)?'class':subclassRecords.includes(item)?'subclass':'background'
    const gained=finite(field(trait,'level'))?integer(field(trait,'level'),1,1,20):origin==='racial'||origin==='background'?1:undefined
    if (finite(field(trait, 'level')) && (field(trait, 'level') as number) > character.meta.level) continue
    if (typeof field(trait, 'description') === 'string') character.features.push({ name: text(field(trait, 'name')), description: text(field(trait, 'description')),origin,level:gained })
    else if (field(trait, 'index')) {
      const detail = await srd('traits', text(field(trait, 'index')))
      if (detail) character.features.push({ name: text(detail.name), description: list(detail.desc).map(text).join('\n\n'),origin,level:gained })
    }
  }
  character.features = [...new Map(character.features.map((feature) => [`${feature.name}\0${feature.description}`, feature])).values()]
  warnings.add('Review HP, AC, speed, feats, subclass effects, and current resources. The link stores choices rather than a complete calculated sheet; custom rules are not executed during import.')
  warnings.add('Prepared spells and spell slots need review. Unavailable source details are preserved rather than silently recreated.')
  if (sourceNames.size) warnings.add(`Matched imported content from: ${[...sourceNames].filter(Boolean).join(', ')}.`)
  if(!character.spellcasting.slotRule&&classChoices.length===1&&classRecords[0]){const progression=suggestedProgression(character);if(progression)character.spellcasting.slotRule={progression,className:character.meta.classLevels![0]!.name}}
  character.spellcasting.slots=resolveCharacterProgression(character).spellcasting.slots
  character.resources=[...(character.resources??[]),...automaticResources(character as Character)]
  character.proficiencies.weapons = compactWeaponProficiencies(character.proficiencies.weapons)
  character.externalImport = { provider: 'dmv', sourceUrl, source, importedAt: new Date().toISOString(), warnings: [...warnings] }
  character.personality.notes = [character.personality.notes, 'Imported from Dungeon Master’s Vault. Original choices are attached to this character.', unresolvedSpells.length ? `Unresolved spells: ${unresolvedSpells.join(', ')}` : ''].filter(Boolean).join('\n\n')
  character.equipment=character.equipment.map(resolveEquipmentItem)
  return { character, warnings: [...warnings], matchedSpells: character.spellcasting.known.length, unresolvedSpells, sourceUrl }
}
