import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import express from 'express'
import type {Server} from 'node:http'
import {streamLargeResponses} from './large-transfer'
import {MAP_LIMITS} from '../../shared/room-maps'

const mapPath=`/api/rooms/${'a'.repeat(24)}/maps/${'b'.repeat(24)}/image`
const image=Buffer.alloc(2_776_932,73),maximum=Buffer.alloc(MAP_LIMITS.imageBytes,73),oversized=Buffer.alloc(MAP_LIMITS.imageBytes+1,74)
const catalog=JSON.stringify({data:'x'.repeat(2*1024*1024)})
const etag='"map-fixture"'
let server:Server,base:string,writes:number[]=[]
beforeAll(async()=>{
 const app=express()
 app.use((_req,res,next)=>{
  const write=res.write.bind(res)
  res.write=((chunk:Uint8Array,...args:any[])=>{writes.push(chunk.byteLength);return (write as any)(chunk,...args)}) as typeof res.write
  next()
 })
 app.use(streamLargeResponses)
 const maps=express.Router({mergeParams:true})
 maps.get('/:mapId/image',(req,res)=>{
  if(req.get('x-test-denied'))return res.status(403).json({error:'Access ended'})
  res.set('Cache-Control','private, no-cache').vary('Cookie').set('ETag',etag)
  if(req.get('if-none-match')===etag)return res.status(304).end()
  if(req.query.json)return res.json({data:'x'.repeat(2*1024*1024)})
  res.type('image/webp').send(req.query.oversized?oversized:req.query.maximum?maximum:req.query.small?image.subarray(0,1024):image)
 })
 app.use('/api/rooms/:roomId/maps',maps)
 app.get('/api/catalog',(_req,res)=>res.type('application/json').send(catalog))
 app.get('/api/binary',(_req,res)=>res.type('image/webp').send(image))
 server=app.listen(0,'127.0.0.1')
 await new Promise<void>(resolve=>server.once('listening',resolve))
 base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
})
beforeEach(()=>{writes=[]})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())))

describe('bounded map image delivery',()=>{
 it('returns unchanged full-quality image bytes with Content-Length and private revalidation',async()=>{
  const response=await fetch(base+mapPath),actual=Buffer.from(await response.arrayBuffer())
  expect(response.status).toBe(200)
  expect(actual.equals(image)).toBe(true)
  expect(response.headers.get('content-length')).toBe(String(image.length))
  expect(response.headers.get('content-type')).toBe('image/webp')
  expect(response.headers.get('cache-control')).toBe('private, no-cache')
  expect(response.headers.get('vary')).toBe('Cookie')
  expect(response.headers.get('etag')).toBe(etag)
  expect(writes).toEqual([])
 })
 it('keeps HEAD body-free while describing the complete image',async()=>{
  const response=await fetch(base+mapPath,{method:'HEAD'})
  expect(response.status).toBe(200)
  expect((await response.arrayBuffer()).byteLength).toBe(0)
  expect(response.headers.get('content-length')).toBe(String(image.length))
  expect(writes).toEqual([])
 })
 it('keeps authorized conditional reads body-free',async()=>{
  const response=await fetch(base+mapPath,{headers:{'If-None-Match':etag}})
  expect(response.status).toBe(304)
  expect((await response.arrayBuffer()).byteLength).toBe(0)
  expect(response.headers.get('cache-control')).toBe('private, no-cache')
  expect(writes).toEqual([])
 })
 it('does not turn a denied request with a validator into a cached success',async()=>{
  const response=await fetch(base+mapPath,{headers:{'If-None-Match':etag,'x-test-denied':'1'}})
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({error:'Access ended'})
  expect(writes).toEqual([])
 })
 it('retains the ordinary small-image response',async()=>{
  const response=await fetch(base+mapPath+'?small=1')
  expect(Buffer.from(await response.arrayBuffer()).equals(image.subarray(0,1024))).toBe(true)
  expect(response.headers.get('content-length')).toBe('1024')
  expect(writes).toEqual([])
 })
 it('buffers an image exactly at the upload limit',async()=>{
  const response=await fetch(base+mapPath+'?maximum=1')
  expect(Buffer.from(await response.arrayBuffer()).equals(maximum)).toBe(true)
  expect(response.headers.get('content-length')).toBe(String(MAP_LIMITS.imageBytes))
  expect(writes).toEqual([])
 })
 it.each([
  [mapPath+'?oversized=1',oversized],
  [mapPath+'?json=1',Buffer.from(catalog)],
  ['/api/catalog',Buffer.from(catalog)],
  ['/api/binary',image],
 ])('retains bounded streaming outside the map-image exception: %s',async(path,body)=>{
  const response=await fetch(base+path)
  expect(Buffer.from(await response.arrayBuffer()).equals(body)).toBe(true)
  expect(response.headers.get('content-length')).toBeNull()
  expect(writes.reduce((sum,n)=>sum+n,0)).toBe(body.length)
  expect(writes.length).toBeGreaterThan(1)
  expect(Math.max(...writes)).toBeLessThanOrEqual(64*1024)
 })
})
