import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { readEdn, type EdnSpan } from '../server/lib/edn'
import { inspectOrcbrew, canonicalContent, sourceHash } from '../server/lib/orcbrew'

// Move the reviewed definitions verbatim, preserving content keys and IDs.
const inputDir = 'output/book-of-shadows'
const output = 'output/monster-source-packs'
const transfer = '.preview.local/source-pack-transfer'
const previous = JSON.parse(readFileSync(`${inputDir}/manifest.json`, 'utf8'))
const snapshot = JSON.parse(readFileSync('.preview.local/5etools-resolved.json', 'utf8'))
const source = readFileSync(`${inputDir}/${previous.filename}`, 'utf8')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
if (sha(source) !== '4b6e5186ef1d20901d64e570c173ef90a4a606fd4c83b22f26690b46d02c9f3d') throw Error('Unexpected expanded source')
const spans = new WeakMap<object, EdnSpan>()
const root = readEdn(source, () => { throw Error('Nonfinite input') }, spans) as Record<string, any>
const monsters = root[':orcpub.dnd.e5/monsters']
const fields = spans.get(monsters)?.fields
if (!fields) throw Error('Missing monster spans')
const groups = new Map<string, string[]>()
for (const [key, monster] of Object.entries(monsters) as [string, any][]) {
  const id = monster[':option-pack']
  if (!snapshot.sources[id] || monster[':codex/extended'].sourceInfo.id !== id) throw Error(`Missing/mismatched source: ${key}`)
  const field = fields[key]
  if (!field) throw Error(`Missing span: ${key}`)
  const group = groups.get(id) ?? []
  group.push(source.slice(field.keyStart, field.end))
  groups.set(id, group)
}
mkdirSync(output, { recursive: true })
mkdirSync(transfer, { recursive: true })
const originals = inspectOrcbrew(source).entries.monsters
const expected = new Map(originals.map(e => [e.index, canonicalContent(e.details)]))
const seen = new Set<string>()
const packs: any[] = []
for (const [id, forms] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  const title = snapshot.sources[id]
  const filename = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '')} [${id}].orcbrew`
  const content = '{:orcpub.dnd.e5/monsters {\n' + forms.join('\n') + '\n}}\n'
  const parsed = inspectOrcbrew(content)
  if (parsed.report.entryCount !== forms.length || parsed.report.counts.monsters !== forms.length || parsed.report.duplicateCount || parsed.report.nonFiniteCount || parsed.report.warnings.length) throw Error(`Invalid pack: ${id}`)
  for (const e of parsed.entries.monsters) {
    if (seen.has(e.index) || e.source !== id || expected.get(e.index) !== canonicalContent(e.details)) throw Error(`Changed/duplicate identity: ${e.index}`)
    seen.add(e.index)
  }
  writeFileSync(`${output}/${filename}`, content)
  writeFileSync(`${transfer}/${id}.json`, JSON.stringify({filename, source: gzipSync(Buffer.from(content), {level: 9}).toString('base64'), sourceEncoding: 'gzip-base64', sourceBytes: Buffer.byteLength(content)}))
  packs.push({id, title, filename, monsters: forms.length, bytes: Buffer.byteLength(content), sha256: sha(content), sourceHash: sourceHash(content), indexes: parsed.entries.monsters.map(e => e.index)})
}
if (seen.size !== 4942 || expected.size !== seen.size || packs.length !== 111) throw Error('Coverage failed')
const manifest = {snapshot: previous.snapshot, builtAt: new Date().toISOString(), total: seen.size, packCount: packs.length, originalPackId: previous.packId, expectedOriginalHash: previous.sourceHash, packs}
writeFileSync(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(`${transfer}/manifest.json`, JSON.stringify(manifest))
const original = readFileSync(`${inputDir}/original.orcbrew`, 'utf8')
if (sha(original) !== 'de8002722f5ae50362d649167c6e89bfa25f95a8fc9e7ec39d42ce8ee42a1b49' || inspectOrcbrew(original).report.entryCount !== 15) throw Error('Unexpected original pack')
writeFileSync(`${transfer}/restore.json`, JSON.stringify({pack: {filename: previous.filename, source: original}, expectedHash: previous.sourceHash}))
console.log(JSON.stringify({packCount: packs.length, monsters: seen.size, bytes: packs.reduce((n, p) => n + p.bytes, 0), examples: packs.filter(p => ['MM','XMM','VGM','MTF','MPMM'].includes(p.id)).map(({indexes,...p})=>p)}))
