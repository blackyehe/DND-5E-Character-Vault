import express from 'express'
import cookieParser from 'cookie-parser'
import { env } from './env'
import { connectDb } from './db'
import { databaseErrorDetails } from './lib/database-error'
import authRoutes from './routes/auth'
import characterRoutes from './routes/characters'
import characterLibraryRoutes from './routes/character-library'
import contentRoutes from './routes/content'
import compendiumRoutes from './routes/compendium'
import compendiumBrowseRoutes from './routes/compendium-browse'
import characterImportRoutes from './routes/character-import'
import workshopRoutes from './routes/workshop'
import roomRoutes from './routes/rooms'
import notebookRoutes from './routes/notebook'
import roomMapRoutes from './routes/room-maps'
import itemRoutes from './routes/items'
import monsterWorkshopRoutes from './routes/monster-workshop'
import workshopTrashRoutes from './routes/workshop-trash'
import { readSrdRule } from './lib/srd-client'
import { uploadRoutes, finishUpload, streamLargeResponses } from './middleware/large-transfer'
import { requireAuth } from './middleware/auth'
import libraryRestoreRoutes from './routes/library-restore'
import { localSrdRule } from './lib/srd-snapshot'
import { enrichedStandardMonster } from './lib/monster-enrichment'
import { MAP_UPLOAD_JSON_BYTES } from '../shared/room-maps'
import cityLibraryRoutes from './routes/city-libraries'

const app = express()
let sampledSheetReads=0
app.disable('x-powered-by')
app.use(streamLargeResponses)
app.use((req,res,next)=>{
  const started=performance.now()
  const json=res.json.bind(res)
  res.json=((body:unknown)=>{
    const duration=performance.now()-started
    res.setHeader('Server-Timing',`app;dur=${duration.toFixed(1)},db;dur=${Number(res.locals.dbReadyMs??0).toFixed(1)}`)
    return json(body)
  }) as typeof res.json
  res.once('finish',()=>{
    if(req.method!=='GET'||!/^\/api\/(?:characters\/[a-f0-9]{24}|rooms\/[a-f0-9]{24}\/characters\/[a-f0-9]{24})(?:\/references)?(?:\?|$)/i.test(req.originalUrl))return
    const duration=performance.now()-started
    if(sampledSheetReads++<4||duration>1000)console.info('Sheet read timing',{kind:req.path.endsWith('/references')?'references':req.query.view==='quick'?'quick':'resolved',serverMs:Math.round(duration),dbReadyMs:Math.round(Number(res.locals.dbReadyMs??0)),status:res.statusCode})
  })
  next()
})
if (process.env.VERCEL) app.set('trust proxy', 1)
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin'), host = req.get('host')
    const allowed = env.APP_ORIGIN?.split(',').map(value => value.trim()).filter(Boolean) ?? []
    try {
      if (req.get('sec-fetch-site') === 'cross-site' || origin && new URL(origin).host !== host && !allowed.includes(origin)) return res.status(403).json({ error: 'Please make changes from the website itself.' })
    } catch { return res.status(403).json({ error: 'Invalid request origin.' }) }
    if (req.headers['content-length'] !== '0' && req.headers['content-length'] && !req.is('application/json')) return res.status(415).json({ error: 'Use an application/json request.' })
  }
  next()
})
app.get('/api/2014/*path', async (req, res) => {
  const path = req.path.slice('/api/2014/'.length)
  if (!/^[a-z0-9/-]+$/i.test(path)) return res.status(400).json({ error: 'Invalid rules reference.' })
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) if (typeof value === 'string') query.set(key, value)
  const reference=path + (query.size ? `?${query}` : '')
  const local=localSrdRule(reference)
  const data=local===undefined?await readSrdRule(env.SRD_API_URL,reference,{interactive:true}):local
  if (!data) return res.status(404).json({ error: 'Rules reference not found.' })
  res.json(enrichedStandardMonster(data,reference))
})
app.use('/api/content/orcbrew-packs', express.json({ limit: '50mb' }))
app.use('/api/rooms/:roomId/maps', express.json({ limit: MAP_UPLOAD_JSON_BYTES }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use('/api', async (_req, res, next) => {const started=performance.now(); await connectDb();res.locals.dbReadyMs=performance.now()-started; next() })
app.use('/api/uploads', uploadRoutes)
app.use((req, res, next) => req.get('x-codex-upload') ? requireAuth(req, res, () => finishUpload(req, res, next)) : next())
app.use('/api/auth', authRoutes)
app.use('/api/library-restore', libraryRestoreRoutes)
app.use('/api/characters/import', characterImportRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/character-library', characterLibraryRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/compendium', compendiumRoutes)
app.use('/api/compendium-browse', compendiumBrowseRoutes)
app.use('/api/workshop', workshopRoutes)
app.use('/api/rooms/:roomId/notebook', notebookRoutes)
app.use('/api/rooms/:roomId/maps', roomMapRoutes)
app.use('/api/rooms/:roomId/cities', cityLibraryRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/monster-workshop', monsterWorkshopRoutes)
app.use('/api/workshop-trash', workshopTrashRoutes)
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))
app.use((err: Error & { status?: number; code?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.status === 413) return res.status(413).json({ error: 'Uploaded request is too large.' })
  if (err.status === 400 || err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ error: 'Invalid request values.' })
  if (err.code === 11000) return res.status(409).json({ error: 'That record already exists. Refresh and try again.' })
  console.error('API request failed', { name: err.name, code: err.code, stage: res.locals.databaseOperation, ...databaseErrorDetails(err) })
  if (!res.headersSent) res.status(503).json({ error: 'The service is temporarily unavailable. Please try again shortly.' })
  else res.end()
})
export default app
