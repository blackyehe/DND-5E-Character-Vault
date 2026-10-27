/** A small raster travels with the protected entry, never through a public image URL. */
export const NOTEBOOK_COVER_MAX_LENGTH = 250000

export function isNotebookCover(value: string): boolean {
  if (value === '') return true
  if (value.length > NOTEBOOK_COVER_MAX_LENGTH) return false
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2]!.length % 4) return false
  try {
    const bytes = atob(match[2]!.slice(0, 48))
    if (match[1] === 'jpeg') return bytes.startsWith('\xff\xd8\xff')
    if (match[1] === 'png') return bytes.startsWith('\x89PNG\r\n\x1a\n')
    return bytes.startsWith('RIFF') && bytes.slice(8,12) === 'WEBP'
  } catch { return false }
}
