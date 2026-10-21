/** Run with server's tsx. Rebuilds public metadata, never account/homebrew data. */
import { writeFile } from 'node:fs/promises'
import { compendiumFacets } from '../shared/compendium-facets'
const revision = '85acb251dad0b044a72c554c2d7f2d0c11e43504'
const categories = ['monsters','classes','races','subraces','subclasses','backgrounds','feats','languages']
const entries = await Promise.all(categories.map(async kind => {
  const filename = kind[0]!.toUpperCase()+kind.slice(1)
  const response = await fetch(`https://raw.githubusercontent.com/5e-bits/5e-srd-api/${revision}/packages/5e-database/src/2014/en/5e-SRD-${filename}.json`, {signal:AbortSignal.timeout(20000)})
  if (!response.ok) throw new Error(`${kind}: ${response.status}`)
  const data = await response.json() as { index:string;name:string;url:string }[]
  return [kind,data.map(entry => {
    const {origin: _origin, source: _source,...filterFacets} = compendiumFacets(entry,kind)
    return {index:entry.index,name:entry.name,url:entry.url,filterFacets}
  })]
}))
await writeFile('server/data/srd-2014-compendium-index.json', JSON.stringify(Object.fromEntries(entries),null,2)+'\n')
console.log(`Saved public filter indexes for ${entries.length} categories at ${revision}.`)
