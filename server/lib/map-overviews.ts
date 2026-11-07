import {MAP_LIMITS, MAP_OVERVIEW_EDGES, type MapImageVariant} from '../../shared/room-maps'

export interface PreparedOverview extends MapImageVariant {data: Buffer}
/** Only called on upload/backfill, never on an image GET. Preserve the original. */
export async function prepareMapOverviews(original: Buffer): Promise<PreparedOverview[]> {
  // Keep the native encoder out of ordinary image GET and application startup.
  const {default: sharp} = await import('sharp')
  const source = sharp(original, {limitInputPixels: MAP_LIMITS.inputPixels, animated: false, failOn: 'warning'})
  const meta = await source.metadata()
  const edge = Math.max(meta.width ?? 0, meta.height ?? 0), variants: PreparedOverview[] = []
  for (const target of MAP_OVERVIEW_EDGES) {
    if (target >= edge) continue
    const {data, info} = await source.clone().rotate().resize({width: target, height: target, fit: 'inside', withoutEnlargement: true}).webp({quality: 85}).toBuffer({resolveWithObject: true})
    // Skip derivatives without a meaningful byte saving, including simple maps.
    if (data.length > original.length * .8) continue
    variants.push({edge: target, width: info.width, height: info.height, bytes: data.length, data})
  }
  return variants
}
