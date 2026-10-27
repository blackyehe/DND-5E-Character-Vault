import { normalizeImportedCharacter } from '../../shared/weapon-proficiencies'
import { resolveCharacterProgression } from '../../shared/character-progression'
import { resourcesFor } from '../../shared/character-resources'
import type { Character } from '../../shared/character'
import { resolveWorkshopCharacter } from './workshop-library'
import { resolveEquipmentItem } from './equipment-references'
import { coreSpell } from './srd-snapshot'
import { legacySrdSpellKey } from '../../src/lib/spell-reference'
import { innateRaceSpells } from '../../shared/workshop-race'
import { withItemBaseline } from '../../shared/item-rules'

export async function characterOutput(character: unknown, ownerId: string | undefined, player = false): Promise<Character> {
  return savedCharacterOutput(await resolveWorkshopCharacter(character,ownerId),player)
}

/** The authenticated opening path does not wait for pack reads or rule rebuilds.
 * The reference response supplies the latest resolved sheet in the background. */
export function savedCharacterOutput(character:unknown,player=false):Character {
  const resolved = resolveCharacterProgression(character as Character)
  const data = normalizeImportedCharacter({ ...resolved, resources: resourcesFor(resolved) }) as Character & Record<string, unknown>
  data.equipment=data.equipment.map(item=>{
    const resolved=resolveEquipmentItem(item)
    if(!item.kind&&!resolved.weapon&&!resolved.armor&&data.attacks.some(a=>a.name.trim().toLowerCase()===item.name.trim().toLowerCase()))resolved.kind='weapon'
    return resolved
  })
  delete data.userId
  delete data.__v
  if (player) delete data.externalImport
  return withItemBaseline(data)
}

export function quickSheetOutput(raw:unknown,player=false) {
  const character=savedCharacterOutput(raw,player)
  const spells=Object.fromEntries([...new Set([...character.spellcasting.known,...character.spellcasting.prepared,...innateRaceSpells(character).map(s=>s.index)])].flatMap((index):[string,Record<string,unknown>][]=>{
    const approved=character.compendiumRules?.find(d=>d.kind==='spells'&&(d.index===index||Array.isArray(d.entry.aliases)&&d.entry.aliases.includes(index)||d.entry.contentKey===index))
    if(approved)return [[index,{...approved.entry,definitionAvailable:true}]]
    const legacy=legacySrdSpellKey(index),definition=coreSpell(legacy??index)
    return definition?[[index,{...definition,sourcePack:'SRD 2014',...(legacy?{referenceFallback:true}:{} )}]]:[]
  }))
  return {character,spells}
}
