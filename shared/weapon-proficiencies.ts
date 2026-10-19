/** Imported sheets sometimes enumerate hundreds of weapon variants. */
export function compactWeaponProficiencies(weapons: string[]): string[] {
  if (!weapons.every(name => typeof name === 'string')) return weapons
  const distinct = [...new Set(weapons.map(name => name.trim()).filter(Boolean))]
  return distinct.length > 20 ? ['All simple weapons', 'All martial weapons'] : weapons
}

export function normalizeImportedCharacter<T extends { externalImport?: unknown; proficiencies?: { weapons?: string[] } }>(character: T, imported = false): T {
  if ((!imported && !character.externalImport) || !Array.isArray(character.proficiencies?.weapons)) return character
  const weapons = compactWeaponProficiencies(character.proficiencies.weapons)
  return weapons === character.proficiencies.weapons ? character : { ...character, proficiencies: { ...character.proficiencies, weapons } }
}
