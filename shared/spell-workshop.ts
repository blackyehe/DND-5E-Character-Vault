import {entrySpellDraft,type SpellBuilder} from './spell-builder'
import type {EntryData} from './compendium-editing'
export interface SpellDraft {version:1;id:string;kind:'spells';source:string;body:SpellBuilder;benefits:unknown[];updatedAt:string;published?:{revision:number;index:string;packId:string;packHash:string;definitionRevision?:number}}
export const spellDraftStorageKey=(owner:string)=>`codex:spell-workshop:v1:${owner}`
export function newSpellDraft():SpellDraft{return {version:1,id:crypto.randomUUID(),kind:'spells',source:'My Homebrew',body:entrySpellDraft({name:'',casting_time:'1 action',range:'Self',duration:'Instantaneous'}),benefits:[],updatedAt:new Date().toISOString()}}
export function spellDraftEntry(draft:SpellDraft):EntryData{return {name:draft.body.name,index:`spell-${draft.id}`,...(draft.body.level===0?{damage:{damage_at_character_level:{}}}:{}),spellBuilder:draft.body,benefits:draft.benefits}}
/** Preserve incomplete device drafts, but never replace storage with malformed data. */
export function restoreSpellDraft(value:unknown):SpellDraft{
 const d=value as SpellDraft,b=d?.body
 if(d?.version!==1||d.kind!=='spells'||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(d.id))||typeof d.source!=='string'||typeof d.updatedAt!=='string'||!Array.isArray(d.benefits)||!b)throw Error('Invalid spell draft')
 for(const key of ['name','description','higherLevel','school','castingTime','range','duration','material','attackType','saveAbility','saveSuccess','damageType','areaType'] as const)if(typeof b[key]!=='string')throw Error('Invalid spell fields')
 for(const key of ['level','areaSize'] as const)if(!Number.isInteger(b[key]))throw Error('Invalid spell numbers')
 for(const key of ['concentration','ritual'] as const)if(typeof b[key]!=='boolean')throw Error('Invalid spell flags')
 for(const key of ['classes','components'] as const)if(!Array.isArray(b[key])||b[key].some(v=>typeof v!=='string'))throw Error('Invalid spell choices')
 for(const key of ['damage','healing'] as const)if(!b[key]||typeof b[key]!=='object'||Array.isArray(b[key])||Object.values(b[key]).some(v=>typeof v!=='string'))throw Error('Invalid spell progression')
 if(d.published&&(!Number.isInteger(d.published.revision)||d.published.revision<1||typeof d.published.index!=='string'||!/^[a-f0-9]{24}$/i.test(d.published.packId)||!/^[a-f0-9]{64}$/i.test(d.published.packHash)))throw Error('Invalid saved spell identity')
 return JSON.parse(JSON.stringify(d)) as SpellDraft
}
