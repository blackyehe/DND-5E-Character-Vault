import {describe,it,expect} from 'vitest'
import {isNotebookArtwork,NOTEBOOK_ARTWORK_MAX_LENGTH} from './notebook-gallery'
describe('protected notebook artwork',()=>{
 it('accepts bounded raster data and rejects remote images, SVG, empty and over-limit content',()=>{
  expect(isNotebookArtwork('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII=')).toBe(true)
  for(const value of ['', 'https://example.com/art.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,ZmFrZQ==','data:image/png;base64,'+'A'.repeat(NOTEBOOK_ARTWORK_MAX_LENGTH)])expect(isNotebookArtwork(value)).toBe(false)
 })
})
