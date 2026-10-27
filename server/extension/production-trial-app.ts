import express, { type Express } from 'express'
import type { ProductionTrialConfig } from './production-trial-config'
import { initializationDiagnostic, type InitializationDiagnostic, type InitializationStage } from './initialization-diagnostic'

/** Default-off dispatcher. Disabling also denies already-issued grants. */
export function createProductionTrialApp(ordinary: Express, config: () => ProductionTrialConfig | undefined, load: (config: ProductionTrialConfig) => Promise<Express>, report: (entry: InitializationDiagnostic) => void = entry => console.error(JSON.stringify(entry))) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  let pending: Promise<Express> | undefined, key = ''
  const reported = new Set<string>()
  const diagnosedErrors = new WeakSet<object>()
  const diagnose = (error: unknown, stage: InitializationStage) => {
    try {
      const objectError = error !== null && (typeof error === 'object' || typeof error === 'function')
      if (objectError && diagnosedErrors.has(error)) return
      const entry = initializationDiagnostic(error, stage), signature = JSON.stringify(entry)
      if (objectError) diagnosedErrors.add(error)
      if (reported.has(signature)) return
      reported.add(signature)
      report(entry)
    } catch { /* Diagnostics must not affect request handling. */ }
  }
  const readConfig = () => {
    try { return config() }
    catch (error) { diagnose(error, 'configuration'); throw error }
  }
  app.use(async (req, res, next) => {
    if (req.path !== '/owlbear/connect' && !/^\/api\/extension\/v1(?:\/|$)/.test(req.path)) return ordinary(req, res, next)
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow' })
    const current = readConfig()
    if (!current) {
      pending = undefined; key = ''
      return res.status(503).json({ error: 'The character-sheet connection is not enabled.' })
    }
    const nextKey = JSON.stringify(current)
    if (!pending || key !== nextKey) {
      key = nextKey
      pending = load(current).then(boundary => { boundary.set('trust proxy', 1); return boundary })
      const attempt = pending
      attempt.catch(error => { diagnose(error, 'boundary'); if (pending === attempt) pending = undefined })
    }
    const boundary = await pending
    // Recheck after asynchronous initialisation so a disabled/rotated trial fails closed.
    if (JSON.stringify(readConfig()) !== nextKey) return res.status(503).json({ error: 'The website connection changed. Reconnect your sheet.' })
    boundary(req, res, next)
  })
  app.use((_req, res) => { res.status(404).json({ error: 'Extension route not found.' }) })
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // The generic 503 can also follow an error raised by a loaded boundary route.
    // Preserve earlier configuration/index stages and never log raw error details.
    diagnose(_error, 'request-dispatch')
    if (!res.headersSent) res.status(503).json({ error: 'The website connection is temporarily unavailable. Try again shortly.' })
    else res.end()
  })
  return app
}
