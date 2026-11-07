import {recoverableModelInitialization} from '../lib/model-initialization'
import {duringInitialization} from './initialization-diagnostic'

interface InitializableModel {
  init(): Promise<unknown>
  createCollection(): Promise<unknown>
  ensureIndexes(): Promise<unknown>
}

/** Keep both index barriers; recover only recognized transient setup failures.
 * The shared helper coalesces requests and never repeats a pairing/session write. */
export function extensionModelReadiness(pairing: InitializableModel, session: InitializableModel) {
  const pairings = recoverableModelInitialization(() => [pairing])
  const sessions = recoverableModelInitialization(() => [session])
  return async () => {
    await Promise.all([
      duringInitialization('pairing-indexes', pairings),
      duringInitialization('session-indexes', sessions),
    ])
  }
}
