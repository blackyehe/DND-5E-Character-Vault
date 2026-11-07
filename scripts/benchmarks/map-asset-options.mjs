// Offline feasibility experiment. Never uploads assets or changes the application.
// node scripts/benchmarks/map-asset-options.mjs --input <private.webp> --out <ignored-directory>
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'

const sharp = createRequire(new URL('../../server/package.json', import.meta.url))('sharp')
const args = process.argv.slice(2)
function argument(name) {
  const index = args.indexOf(name)
  assert.ok(index >= 0 && args[index + 1], `Required: ${name}`)
  return path.resolve(args[index + 1])
}
const inputPath = argument('--input'), output = argument('--out')
assert.notEqual(inputPath, path.join(output, 'report.json'))
await fs.mkdir(output, {recursive: true})
const original = await fs.readFile(inputPath)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const {data: pixels, info} = await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject: true})
const {width, height, channels} = info
assert.equal(channels, 4)
const imageEdge = Math.max(width, height), tileSize = 512, overlap = 1
const started = performance.now(), levels = []
let verifiedHighestTiles = 0
for (const edge of [512, 1024, 2048, imageEdge].filter((v, i, all) => v <= imageEdge && all.indexOf(v) === i)) {
  const highest = edge === imageEdge
  const raw = highest ? {data: pixels, info} : await sharp(original)
    .resize({width: edge, height: edge, fit: 'inside', withoutEnlargement: true})
    .ensureAlpha().raw().toBuffer({resolveWithObject: true})
  const level = {edge, width: raw.info.width, height: raw.info.height, tiles: [], bytesLossy85: 0, bytesPreserveHighest: 0}
  const rawOptions = {raw: {width: level.width, height: level.height, channels}}
  for (let row = 0; row < Math.ceil(level.height / tileSize); row++) {
    for (let column = 0; column < Math.ceil(level.width / tileSize); column++) {
      // One-pixel overlap on interior edges. Core rectangles determine visibility.
      const x = column * tileSize, y = row * tileSize
      const left = Math.max(0, x - overlap), top = Math.max(0, y - overlap)
      const right = Math.min(level.width, x + tileSize + overlap)
      const bottom = Math.min(level.height, y + tileSize + overlap)
      const region = {left, top, width: right - left, height: bottom - top}
      const crop = sharp(raw.data, rawOptions).extract(region)
      const lossy = await crop.clone().webp({quality: 85}).toBuffer()
      let preserved = lossy
      if (highest) {
        preserved = await crop.clone().webp({lossless: true, effort: 4}).toBuffer()
        const expected = await crop.clone().raw().toBuffer()
        const actual = await sharp(preserved).ensureAlpha().raw().toBuffer()
        assert.equal(sha(actual), sha(expected), `Pixel mismatch at ${column},${row}`)
        verifiedHighestTiles++
      }
      const tile = {column, row, x, y, coreWidth: Math.min(tileSize, level.width - x), coreHeight: Math.min(tileSize, level.height - y), bytesLossy85: lossy.length, bytesPreserveHighest: preserved.length}
      level.tiles.push(tile)
      level.bytesLossy85 += lossy.length
      level.bytesPreserveHighest += preserved.length
    }
  }
  levels.push(level)
}

// Match MapCanvas.fit's 32 CSS-pixel inset, not a full-bleed idealized image.
// Camera centered; no prefetch ring, response headers, or previous cached levels.
const viewports = []
for (const viewport of [{width: 390, height: 650}, {width: 640, height: 900}, {width: 1200, height: 900}]) {
  const fitScale = Math.max(.01, Math.min((viewport.width - 32) / width, (viewport.height - 32) / height))
  for (const dpr of [1, 2]) {
    for (const zoom of [1, 2, 4]) {
      const scale = fitScale * zoom
      const desiredEdge = imageEdge * Math.min(1, scale * dpr)
      const level = levels.find(l => l.edge >= desiredEdge) ?? levels.at(-1)
      const levelScale = level.width / width
      const visibleWidth = Math.min(width, viewport.width / scale)
      const visibleHeight = Math.min(height, viewport.height / scale)
      const bounds = {left: (width - visibleWidth) / 2 * levelScale, right: (width + visibleWidth) / 2 * levelScale, top: (height - visibleHeight) / 2 * levelScale, bottom: (height + visibleHeight) / 2 * levelScale}
      const visible = level.tiles.filter(t => t.x < bounds.right && t.x + t.coreWidth > bounds.left && t.y < bounds.bottom && t.y + t.coreHeight > bounds.top)
      viewports.push({...viewport, dpr, zoom, desiredEdge, selectedEdge: level.edge, requests: visible.length, bytesLossy85: visible.reduce((n, t) => n + t.bytesLossy85, 0), bytesPreserveHighest: visible.reduce((n, t) => n + t.bytesPreserveHighest, 0)})
    }
  }
}
const overviewOptions = []
for (const edge of [768, 1024, 1536, 2048].filter(e => e < imageEdge)) {
  const begin = performance.now()
  const {data, info: derivative} = await sharp(original).resize({width: edge, height: edge, fit: 'inside'}).webp({quality: 85}).toBuffer({resolveWithObject: true})
  overviewOptions.push({edge, width: derivative.width, height: derivative.height, bytes: data.length, encodeMs: performance.now() - begin, decodedRgbaBytes: derivative.width * derivative.height * 4})
}
const result = {
  at: new Date().toISOString(), source: {bytes: original.length, sha256: sha(original), width, height, decodedRgbaBytes: pixels.length},
  configuration: {tileSize, overlap, lowerLevels: 'resampled WebP quality 85', highestVariants: ['lossless, decoded RGBA hash verified for every tile', 'quality 85, re-encoded and not pixel-identical'], camera: 'centered; no previous-level bytes, headers, or speculative tiles included'},
  overviewOptions,
  pyramid: {tiles: levels.reduce((n, l) => n + l.tiles.length, 0), bytesLossy85: levels.reduce((n, l) => n + l.bytesLossy85, 0), bytesPreserveHighest: levels.reduce((n, l) => n + l.bytesPreserveHighest, 0), verifiedHighestTiles, levels: levels.map(({tiles, ...level}) => ({...level, count: tiles.length}))},
  viewports, elapsedMs: performance.now() - started,
  limitations: ['One existing map; compression ratios do not generalize to every map.', 'Byte reduction is measured offline; no hosted latency gain is established.', 'Lossless verification compares decoded RGBA pixels; this is not a browser color-management certification.', 'Derivative bytes are additional storage if the original is retained.'],
}
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
