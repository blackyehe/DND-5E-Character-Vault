import {createReadStream} from 'node:fs'
import {createInterface} from 'node:readline'

if (process.argv.length !== 3) throw Error('Usage: node scripts/summarize-request-timing.mjs server.log')
const groups = new Map()
const skipped = {invalidJson: 0, wrongEvent: 0, missingFields: 0, completeNotTrue: 0}
for await (const line of createInterface({input: createReadStream(process.argv[2]), crlfDelay: Infinity})) {
  let row
  try {row = JSON.parse(line)} catch {skipped.invalidJson++; continue}
  // Some hosting log exports wrap the actual application JSON in message.
  if (typeof row?.message === 'string') {try {row = JSON.parse(row.message)} catch {skipped.invalidJson++; continue}}
  if (row?.event !== 'request_timing') {skipped.wrongEvent++; continue}
  if (row.complete !== true) {skipped.completeNotTrue++; continue}
  const notebook = typeof row.endpoint === 'string' && row.endpoint.startsWith('notebook.')
  if (typeof row.endpoint !== 'string' || !row.endpoint || !['DM', 'player', null].includes(row.role)
    || !['handlerMs', 'dbMs', 'responseBytes'].every(field => Number.isFinite(row[field]) && row[field] >= 0)
    || (row.endpoint === 'notebook.listing' && typeof row.searchUsed !== 'boolean')
    || (notebook && row.searchUsed != null && typeof row.searchUsed !== 'boolean')) {
    skipped.missingFields++; continue
  }
  // Navigation/detail logs do not record searchUsed; keep those distinct from false.
  const dimensions = {endpoint: row.endpoint, role: row.role ?? 'none', ...(notebook ? {searchUsed: row.searchUsed ?? null} : {})}
  const key = JSON.stringify(dimensions)
  if (!groups.has(key)) groups.set(key, {dimensions, rows: []})
  groups.get(key).rows.push({handlerMs: row.handlerMs, dbMs: row.dbMs, responseBytes: row.responseBytes, cache: row.cache})
}
console.error(JSON.stringify({skipped}))
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
const maximum = (rows, field) => rows.reduce((max, row) => Math.max(max, row[field]), -Infinity)
console.log(JSON.stringify([...groups].sort(([a], [b]) => a.localeCompare(b)).map(([, {dimensions, rows}]) => {
  const hits = rows.filter(row => row.cache === 'hit').length
  const misses = rows.filter(row => row.cache === 'miss').length
  return {
    ...dimensions, requests: rows.length,
    handlerP50Ms: percentile(rows.map(r => r.handlerMs), 0.5), handlerP95Ms: percentile(rows.map(r => r.handlerMs), 0.95),
    handlerMaxMs: maximum(rows, 'handlerMs'),
    dbP50Ms: percentile(rows.map(r => r.dbMs), 0.5), dbP95Ms: percentile(rows.map(r => r.dbMs), 0.95),
    dbMaxMs: maximum(rows, 'dbMs'),
    responseBytesP50: percentile(rows.map(r => r.responseBytes), 0.5),
    // Request-level fraction over explicit hits/misses; mixed/unknown are excluded and counted.
    ...(dimensions.endpoint.startsWith('compendium.') ? {
      cacheHits: hits, cacheMisses: misses, cacheUnclassified: rows.length - hits - misses,
      cacheHitRate: hits + misses ? hits / (hits + misses) : null,
    } : {}),
  }
}), null, 2))
