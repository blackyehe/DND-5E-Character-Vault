import {NOTEBOOK_COVER_MAX_LENGTH} from '../../shared/notebook-cover'
import {NOTEBOOK_ARTWORK_MAX_LENGTH} from '../../shared/notebook-gallery'

/** Decode locally, bound dimensions and strip metadata by encoding a fresh raster. */
export async function prepareNotebookCover(file: File): Promise<string> {
  return prepareNotebookImage(file,1600,900,NOTEBOOK_COVER_MAX_LENGTH)
}
export async function prepareNotebookArtwork(file: File): Promise<string> {
  return prepareNotebookImage(file,1800,1800,NOTEBOOK_ARTWORK_MAX_LENGTH)
}
async function prepareNotebookImage(file:File,maxWidth:number,maxHeight:number,maxLength:number):Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
  const url = URL.createObjectURL(file), image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { image.src = ''; reject(new Error('This image is taking too long to open. Try a smaller image.')) }, 15000)
      image.onload = () => { clearTimeout(timer); resolve() }
      image.onerror = () => { clearTimeout(timer); reject(new Error('This image could not be opened. Try another JPG, PNG or WebP file.')) }
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose an image with fewer than 40 million pixels.')
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this image.')
    let scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
    for (let attempt = 0; attempt < 4; attempt++, scale *= .75) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.fillStyle = '#242026'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [.86, .72, .58, .44]) {
        const result = canvas.toDataURL('image/jpeg', quality)
        if (result.length <= maxLength) return result
      }
    }
    throw new Error('This image is too detailed. Try a smaller image.')
  } finally { image.onload = null; image.onerror = null; URL.revokeObjectURL(url) }
}
