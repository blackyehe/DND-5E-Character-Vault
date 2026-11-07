import { inspectOrcbrew, sourceHash, type ParsedOrcbrew } from './orcbrew'
import { packSource } from './pack-storage'

const cache = new Map<string, { parsed: ParsedOrcbrew; bytes: number }>()
let cacheBytes = 0

/** Reuse only an already parsed exact source fingerprint. The caller must first
 * obtain that fingerprint from the current, authorized pack metadata. */
export function cachedParsedPack(hash:unknown):ParsedOrcbrew|undefined {
  if(typeof hash!=='string')return undefined
  const cached=cache.get(hash)
  if(!cached)return undefined
  cache.delete(hash);cache.set(hash,cached)
  return cached.parsed
}

export function parsedPack(data: unknown): ParsedOrcbrew {
  const source = packSource(data)
  const hash = sourceHash(source)
  const cached = cachedParsedPack(hash)
  if (cached) return cached
  const parsed = inspectOrcbrew(source)
  const bytes = Buffer.byteLength(source) + Buffer.byteLength(JSON.stringify(parsed))
  while (cache.size && cacheBytes + bytes > 32 * 1024 * 1024) {
    const oldest = cache.keys().next().value!
    cacheBytes -= cache.get(oldest)!.bytes
    cache.delete(oldest)
  }
  if (bytes <= 32 * 1024 * 1024) {
    cache.set(hash, { parsed, bytes })
    cacheBytes += bytes
  }
  return parsed
}
