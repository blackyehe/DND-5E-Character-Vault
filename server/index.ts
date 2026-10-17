import express from 'express'
import cookieParser from 'cookie-parser'
import { env } from './env'
import { connectDb } from './db'
import authRoutes from './routes/auth'
import characterRoutes from './routes/characters'
import contentRoutes from './routes/content'

const app = express()

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/characters', characterRoutes)
app.use('/api/content', contentRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  },
)

async function main() {
  await connectDb()
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
