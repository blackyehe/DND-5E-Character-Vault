export const NOTEBOOK_TAG_LIMIT = 20
export const NOTEBOOK_TAG_LENGTH = 48
export const notebookTagKey = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('hu')
export function notebookTags(values: readonly string[] = []): string[] {
  const seen = new Set<string>()
  return values.map(value=>value.normalize('NFC').trim().replace(/\s+/gu,' ')).filter(value=>{
    const key=notebookTagKey(value)
    if(!key||seen.has(key))return false
    seen.add(key);return true
  })
}
/** Derive suggestions only from entries already filtered by notebook permissions. */
export function notebookTagOptions(entries: {tags?: readonly string[] | null}[], catalog: readonly string[] = []) {
  const counts=new Map<string,{name:string;count:number}>()
  for(const entry of entries)for(const name of notebookTags(entry.tags??[])){
    const key=notebookTagKey(name),existing=counts.get(key)
    if(existing)existing.count++;else counts.set(key,{name,count:1})
  }
  for(const name of notebookTags(catalog))if(!counts.has(notebookTagKey(name)))counts.set(notebookTagKey(name),{name,count:0})
  return [...counts.values()].sort((a,b)=>a.name.localeCompare(b.name,'hu'))
}
export function notebookMatchesTags(entry: {tags?: readonly string[] | null}, selected: readonly string[]) {
  const keys=new Set((entry.tags??[]).map(notebookTagKey))
  return selected.every(tag=>keys.has(notebookTagKey(tag)))
}
/** Reapply only the user's additions/removals to a newly loaded revision. */
export function mergeNotebookTagChanges(latest:readonly string[],before:readonly string[],desired:readonly string[]) {
  const initial=new Set(before.map(notebookTagKey)),wanted=new Set(desired.map(notebookTagKey))
  const removed=new Set([...initial].filter(key=>!wanted.has(key)))
  return notebookTags([...latest.filter(tag=>!removed.has(notebookTagKey(tag))),...desired.filter(tag=>!initial.has(notebookTagKey(tag)))])
}
