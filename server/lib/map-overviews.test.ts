import {expect, it} from 'vitest'
import sharp from 'sharp'
import {prepareMapOverviews} from './map-overviews'
import {createHash, randomBytes} from 'node:crypto'

it('generates bounded, useful aspect-preserving views without mutating original bytes',async()=>{
  const source = await sharp(randomBytes(1536*2304*3),{raw:{width:1536,height:2304,channels:3}}).webp({quality:85}).toBuffer()
  const hash = createHash('sha256').update(source).digest('hex')
  const views = await prepareMapOverviews(source)
  expect(views.map(v=>v.edge)).toEqual([1024,2048])
  for (const view of views) {
    expect(view.bytes).toBe(view.data.length)
    expect(view.bytes).toBeLessThan(source.length*.8)
    expect(view.width/view.height).toBeCloseTo(2/3,2)
    const decoded=await sharp(view.data).raw().toBuffer({resolveWithObject:true})
    expect(decoded.info.width).toBe(view.width);expect(decoded.info.height).toBe(view.height)
  }
  expect(createHash('sha256').update(source).digest('hex')).toBe(hash)
},15000)
it('skips small originals and derivatives that do not save enough bytes',async()=>{
  expect(await prepareMapOverviews(await sharp({create:{width:600,height:400,channels:3,background:'red'}}).webp().toBuffer())).toEqual([])
  const large = await sharp({create:{width:4096,height:3072,channels:3,background:'red'}}).webp().toBuffer()
  for(const variant of await prepareMapOverviews(large)) expect(variant.bytes).toBeLessThanOrEqual(large.length*.8)
})
