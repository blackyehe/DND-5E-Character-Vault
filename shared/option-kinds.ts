/** Lightweight identity metadata; safe for parser and initial application imports. */
export const OPTION_KINDS=['feats','backgrounds','invocations','boons','selections','languages','other','subraces'] as const
export const FEATURE_OPTION_KINDS=['feats','invocations','boons','selections','other'] as const
export const MANUAL_OPTION_KINDS=['invocations','boons','selections','other'] as const
export type OptionKind=typeof OPTION_KINDS[number]
export type FeatureOptionKind=typeof FEATURE_OPTION_KINDS[number]
export type ManualOptionKind=typeof MANUAL_OPTION_KINDS[number]
export const optionTitle=(kind:OptionKind)=>({feats:'feat',backgrounds:'background',invocations:'invocation',boons:'boon',selections:'choice group',languages:'language',other:'reference',subraces:'subrace'} as const)[kind]
export const optionCreationKind=(kind:OptionKind)=>({feats:'feat',backgrounds:'background',invocations:'invocation',boons:'boon',selections:'selection',languages:'language',other:'reference',subraces:'subrace'} as const)[kind]
export const isOptionKind=(kind:unknown):kind is OptionKind=>(OPTION_KINDS as readonly unknown[]).includes(kind)
export const isFeatureOptionKind=(kind:unknown):kind is FeatureOptionKind=>(FEATURE_OPTION_KINDS as readonly unknown[]).includes(kind)
export const isManualOptionKind=(kind:unknown):kind is ManualOptionKind=>(MANUAL_OPTION_KINDS as readonly unknown[]).includes(kind)
