import type { Character } from '../../shared/character'
import type { HomebrewBackground, HomebrewClass, HomebrewFeat, HomebrewRace, HomebrewSubclass, SrdSpell } from './srd'

export interface SheetReferences {
  character?:Character
  spells:SrdSpell[]
  feats:HomebrewFeat[]
  races:HomebrewRace[]
  subclasses:HomebrewSubclass[]
  classes:HomebrewClass[]
  backgrounds:HomebrewBackground[]
}

// Session memory only. A fresh authorized character read supplies both version
// markers before a response can be reused; private HTTP caching stays disabled.
const entries=new Map<string,{expires:number;value:SheetReferences;bytes:number}>()
const lifetime=2*60*1000,limit=24,budget=4*1024*1024
let epoch=0
export function sheetReferenceCacheKey(input:{userId?:string;path:string;role:string;version:string;revision:string;preview?:boolean}) {
  return input.userId&&input.version&&input.revision&&!input.preview
    ?JSON.stringify([input.userId,input.path,input.role,input.version,input.revision]):undefined
}
export const sheetReferenceCache={
  get epoch(){return epoch},
  read(key:string) {
    const entry=entries.get(key)
    if(!entry)return undefined
    if(entry.expires<=Date.now()){entries.delete(key);return undefined}
    entries.delete(key);entries.set(key,entry)
    return structuredClone(entry.value)
  },
  write(key:string,value:SheetReferences,expectedEpoch:number) {
    if(expectedEpoch!==epoch)return
    // Original import documents are not needed for reference reuse. The caller
    // retains the fresh authorized sheet's import metadata when applying a hit.
    const compact={...value,character:value.character?{...value.character,externalImport:undefined}:undefined}
    const bytes=JSON.stringify(compact).length*2
    if(bytes>budget)return
    entries.delete(key)
    let used=[...entries.values()].reduce((sum,entry)=>sum+entry.bytes,0)
    while(entries.size>=limit||used+bytes>budget){
      const oldest=entries.keys().next().value!
      used-=entries.get(oldest)!.bytes;entries.delete(oldest)
    }
    entries.set(key,{expires:Date.now()+lifetime,value:structuredClone(compact),bytes})
  },
  clear(){epoch++;entries.clear()},
}

/** Play counters do not change which rule definitions a sheet needs. All other
 * saved fields remain inputs, including equipment, choices and feature text. */
export function sheetReferenceInputs(c:Character) {
  return JSON.stringify({meta:c.meta,abilities:c.abilities,saves:c.saves,skills:c.skills,
    proficiencies:c.proficiencies,features:c.features,equipment:c.equipment,
    attacks:c.attacks,homebrew:c.homebrew,companionKind:c.companionKind,
    compendiumRules:c.compendiumRules?.map(d=>({kind:d.kind,index:d.index,revision:d.revision,sourceHash:d.sourceHash})),
    combat:{...c.combat,hpCurrent:undefined,hpTemp:undefined,hitDiceUsed:undefined,
      deathSavesSuccess:undefined,deathSavesFailure:undefined,inspiration:undefined},
    resources:c.resources?.map(resource=>({...resource,used:undefined})),
    spellcasting:{...c.spellcasting,slots:Object.fromEntries(Object.entries(c.spellcasting.slots)
      .map(([key,slot])=>[key,{...slot,used:undefined}]))},
  })
}
