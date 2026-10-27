import {describe,expect,it} from 'vitest'
import {isNotebookCover,NOTEBOOK_COVER_MAX_LENGTH} from './notebook-cover'

export const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII='

describe('notebook cover payload',()=>{
  it('allows removal and bounded raster payloads',()=>{
    expect(isNotebookCover('')).toBe(true)
    expect(isNotebookCover(pixel)).toBe(true)
    expect(isNotebookCover('data:image/jpeg;base64,'+btoa('\xff\xd8\xff\xe0test'))).toBe(true)
    expect(isNotebookCover('data:image/webp;base64,'+btoa('RIFF1234WEBPtest!'))).toBe(true)
  })
  it('rejects URLs, SVG, MIME spoofing, malformed base64 and oversize payloads',()=>{
    for(const value of ['https://example.com/image.png','data:image/svg+xml;base64,'+btoa('<svg/>'),pixel.replace('image/png','image/jpeg'),pixel+'%',pixel.slice(0,-1),'data:image/png;base64,'+'A'.repeat(NOTEBOOK_COVER_MAX_LENGTH)])expect(isNotebookCover(value)).toBe(false)
  })
})
