import { CustomContent } from '../models/CustomContent'

let pending: Promise<unknown> | undefined

/** Model.init() retains its first rejection for the lifetime of a warm server.
 * Explicit index creation can recover after an initial connection timeout while
 * still requiring the unique source-hash index before accepting an import. */
export async function ensureContentIndexes() {
  if (!pending) pending = CustomContent.createIndexes().catch(error => {
    pending = undefined
    throw error
  })
  await pending
}
