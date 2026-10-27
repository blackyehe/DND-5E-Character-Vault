import express, { type Express } from 'express'
import type { SharedTestConfig } from './shared-test-config'

/** Separate dispatcher: ordinary website middleware continues to own ordinary routes. */
export function createSharedTestApp(config: SharedTestConfig, ordinaryApp: Express, loadExtension: () => Promise<Express>) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow' })
    next()
  })
  let pending: Promise<Express> | undefined
  const extension = () => pending ??= loadExtension().then(boundary => {
    // The independently created Express boundary owns req.app during handling.
    // Apply the same one-proxy policy as the website for per-client limits.
    boundary.set('trust proxy', 1)
    return boundary
  }).catch(error => { pending = undefined; throw error })
  app.get('/__owlbear_shared_test', async (_req, res) => {
    // Readiness includes DB connection/index initialisation; never return credentials.
    await extension()
    res.json({ application: 'owlbear-shared-test', environmentId: config.environmentId, database: config.database, projectId: config.projectId, rememberedConnections: config.rememberedConnections })
  })
  app.use(async (req, res, next) => {
    if (req.path !== '/owlbear/connect' && !/^\/api\/extension\/v1(?:\/|$)/.test(req.path)) return ordinaryApp(req, res, next)
    const boundary = await extension()
    boundary(req, res, next)
  })
  app.use((_req, res) => { res.status(404).json({ error: 'Test route not found.' }) })
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (!res.headersSent) res.status(503).json({ error: 'The test service is temporarily unavailable. Please try again shortly.' })
    else res.end()
  })
  return app
}
