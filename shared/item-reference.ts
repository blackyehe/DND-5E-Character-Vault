/** Naming aliases group the browser list; each source definition remains selectable. */
export function normalizeItemName(name:string) {
  return name.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/^(.+?),\s*(\+\d+)$/,'$2 $1').replace(/\s+/g,' ')
}
