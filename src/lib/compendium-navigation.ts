export const compendiumGroups = [
  { label: 'Spells', entries: [{ value: 'spells', label: 'Spells' }] },
  { label: 'Items', entries: [{ value: 'equipment', label: 'Normal items' }, { value: 'magic-items', label: 'Magic items' }] },
  { label: 'Classes', entries: [{ value: 'classes', label: 'Classes' }, { value: 'subclasses', label: 'Subclasses' }] },
  { label: 'Races', entries: [{ value: 'races', label: 'Races' }, { value: 'subraces', label: 'Subraces' }] },
  { label: 'Monsters', entries: [{ value: 'monsters', label: 'Monsters' }] },
  { label: 'Character options', entries: [
    { value: 'backgrounds', label: 'Backgrounds' }, { value: 'feats', label: 'Feats' },
    { value: 'invocations', label: 'Invocations' }, { value: 'boons', label: 'Boons' },
    { value: 'selections', label: 'Selections' },
  ] },
  { label: 'Reference', entries: [{ value: 'languages', label: 'Languages' }, { value: 'other', label: 'Other reference' }] },
  { label: 'Homebrew files', entries: [{ value: 'homebrew', label: 'Homebrew files' }] },
] as const

export type CompendiumTab = typeof compendiumGroups[number]['entries'][number]['value']
export const compendiumTabLabel = (tab: CompendiumTab) => compendiumGroups.flatMap(group => [...group.entries]).find(entry => entry.value === tab)!.label
