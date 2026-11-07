import {NOTEBOOK_LISTING_VERSION} from './notebook-derived'

interface ChangeSource {
  kind?:unknown;section?:unknown;audience?:unknown;characterIds?:readonly unknown[];deletedAt?:unknown
}
/** Updated in the same transaction as source, derived fields and history.
 * Include both old/new audiences and sections when sharing or moving an entry. */
export function notebookChangeIncrements(before:ChangeSource|undefined,after:ChangeSource) {
  const paths=new Set<string>()
  for(const entry of [before,after]){
    if(!entry||entry.kind!=='entry')continue
    if(entry.section!=='journal'&&entry.section!=='story-items')throw Error('Invalid notebook section')
    for(const section of ['all',entry.section]){
      paths.add(`notebookChanges.dm.${section}`)
      if(entry.deletedAt!=null)continue
      if(entry.audience==='room')paths.add(`notebookChanges.room.${section}`)
      if(entry.audience==='characters')for(const raw of entry.characterIds??[]){
        const id=String(raw)
        if(!/^[a-f0-9]{24}$/i.test(id))throw Error('Invalid notebook character')
        paths.add(`notebookChanges.characters.${id}.${section}`)
      }
    }
  }
  return Object.fromEntries([...paths].map(path=>[path,1]))
}
function at(value:unknown,...path:string[]):number {
  for(const key of path)value=value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined
  return typeof value==='number'&&Number.isSafeInteger(value)?value:0
}
/** A player's token contains no counters for hidden/deleted entries. */
export function notebookChangeIdentity(changes:unknown,dm:boolean,allowed:readonly string[],section:string) {
  return [NOTEBOOK_LISTING_VERSION,section,dm?at(changes,'dm',section):[at(changes,'room',section),[...allowed].sort().map(id=>[id,at(changes,'characters',id,section)])]]
}
