// Keep the application-wide preparation queue independent of filter code and
// the equipment datasets loaded by the actual Compendium view and its worker.
export const BROWSE_KINDS = ['spells','equipment','magic-items','classes','subclasses','races','subraces','monsters','backgrounds','feats','invocations','boons','selections','languages','other'] as const
export type BrowseKind = typeof BROWSE_KINDS[number]
