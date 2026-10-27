// Only fixed labels leave the process. Never log an error message, stack or cause.
export type InitializationStage = 'configuration' | 'database' | 'boundary' | 'pairing-indexes' | 'session-indexes' | 'family-indexes' | 'renewal-indexes' | 'request-dispatch'
const databaseCodes = new Set([13, 18, 48, 67, 85, 86, 11000, 8000])
const errorKinds = new Set(['MongoServerError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoServerSelectionError', 'MongooseServerSelectionError'])
export type InitializationDiagnostic = { event: 'owlbear-initialization-failed'; stage: InitializationStage; kind: string; code?: number }

class InitializationFailure extends Error {
  readonly stage: InitializationStage
  readonly original: unknown
  constructor(stage: InitializationStage, original: unknown) {
    super('Extension initialization failed.')
    this.stage = stage
    this.original = original
  }
}

export async function duringInitialization<T>(stage: InitializationStage, work: () => Promise<T>): Promise<T> {
  try { return await work() }
  catch (error) { throw error instanceof InitializationFailure ? error : new InitializationFailure(stage, error) }
}

export function initializationDiagnostic(error: unknown, fallback: InitializationStage): InitializationDiagnostic {
  const stage = error instanceof InitializationFailure ? error.stage : fallback
  const original = error instanceof InitializationFailure ? error.original : error
  // Descriptor reads exclude arbitrary getters. Unknown driver values remain unreported.
  const name = original instanceof Error ? Object.getOwnPropertyDescriptor(original, 'name')?.value : undefined
  const prototypeName = original instanceof Error ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(original), 'name')?.value : undefined
  const constructor = original instanceof Error ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(original), 'constructor')?.value : undefined
  const constructorName = typeof constructor === 'function' ? Object.getOwnPropertyDescriptor(constructor, 'name')?.value : undefined
  const code = original && typeof original === 'object' ? Object.getOwnPropertyDescriptor(original, 'code')?.value : undefined
  const kind = [name, prototypeName, constructorName].find(value => typeof value === 'string' && errorKinds.has(value)) ?? 'unclassified'
  return { event: 'owlbear-initialization-failed', stage, kind, ...(typeof code === 'number' && databaseCodes.has(code) ? { code } : {}) }
}
