import {isTransientDatabaseError} from './database-error'

interface InitializableModel {
  init(): Promise<unknown>
  createCollection(): Promise<unknown>
  ensureIndexes(): Promise<unknown>
}

/** Keep the index barrier without retaining Model.init()'s rejected promise.
 * Recovery only repeats idempotent storage setup, never a save transaction. */
export function recoverableModelInitialization(models: () => readonly InitializableModel[]) {
  let pending: Promise<void> | undefined
  async function initialize() {
    for (const model of models()) {
      try { await model.init() }
      catch (error) {
        if (!isTransientDatabaseError(error)) throw error
        await model.createCollection()
        await model.ensureIndexes()
      }
    }
  }
  return async () => {
    pending ??= Promise.resolve().then(initialize).catch(error => { pending = undefined; throw error })
    await pending
  }
}
