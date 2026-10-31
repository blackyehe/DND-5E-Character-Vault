import type {BrowseEntry,BrowseKind} from './compendium-browse'

// Bump when detail interpretation or bundled rule/enrichment snapshots change.
export const COMPENDIUM_DETAIL_VERSION='compendium-details-1'
export interface CompendiumDetailRevision {owner:string;kind:BrowseKind;version:typeof COMPENDIUM_DETAIL_VERSION;revision:string}
export interface CompendiumDetailResponse extends CompendiumDetailRevision {index:string;entry:BrowseEntry}
