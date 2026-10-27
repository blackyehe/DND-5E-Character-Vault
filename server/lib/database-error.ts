import { env } from '../env'

const transientNames = new Set([
  'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongooseServerSelectionError',
  'MongoServerSelectionError', 'MongoWaitQueueTimeoutError', 'MongoPoolClearedError',
  'PoolClearedOnNetworkError',
])
export function isTransientDatabaseError(error: unknown): error is Error {
  return error instanceof Error && transientNames.has(error.name)
}

type DatabaseStage = 'notebook-initialization' | 'notebook-transaction' | 'map-initialization' | 'map-transaction'
const failures = new WeakMap<Error, {stage: DatabaseStage; operationMs: number}>()

/** Stage names and timings only; retain no request or document data. */
export async function withDatabaseStage<T>(stage: DatabaseStage, operation: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try { return await operation() }
  catch (error) {
    if (error instanceof Error) failures.set(error, {stage, operationMs: Math.round(performance.now() - started)})
    throw error
  }
}

/** Connection diagnostics only; never log queries, documents or credentials. */
export function databaseErrorDetails(error: Error): Record<string, unknown> {
  if (!isTransientDatabaseError(error)) return {}
  const secrets = [env.MONGO_URI, env.JWT_SECRET, process.env.MONGO_PASSWORD]
  try { secrets.push(decodeURIComponent(new URL(env.MONGO_URI).password)) } catch { /* Driver-specific URI syntax. */ }
  const redact = (message: string) => {
    let result = message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[database URI]')
    for (const secret of secrets) if (secret) {
      result = result.split(secret).join('[redacted]')
      result = result.split(encodeURIComponent(secret)).join('[redacted]')
    }
    return result.slice(0, 800)
  }
  const causes: Record<string, unknown>[] = []
  let cause: unknown = error
  for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
    const current = cause as Error & {code?: unknown; cause?: unknown}
    causes.push({
      name: redact(current.name), message: redact(current.message),
      code: typeof current.code === 'number' ? current.code : typeof current.code === 'string' ? redact(current.code) : undefined,
      frames: redact((current.stack ?? '').split('\n').filter(line => /^\s+at /.test(line)).slice(0, 5).join('\n')),
    })
    cause = current.cause
  }
  return {...failures.get(error), connectionErrors: causes}
}
