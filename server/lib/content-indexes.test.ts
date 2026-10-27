import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../models/CustomContent', () => ({CustomContent: {createIndexes: vi.fn()}}))
beforeEach(() => {vi.resetModules(); vi.clearAllMocks()})

describe('content import index readiness', () => {
  it('shares successful index creation across concurrent imports', async () => {
    const {CustomContent} = await import('../models/CustomContent')
    vi.mocked(CustomContent.createIndexes).mockResolvedValue(undefined)
    const {ensureContentIndexes} = await import('./content-indexes')
    await Promise.all([ensureContentIndexes(), ensureContentIndexes(), ensureContentIndexes()])
    await ensureContentIndexes()
    expect(CustomContent.createIndexes).toHaveBeenCalledTimes(1)
  })

  it('rejects the import on index failure and retries on the next request', async () => {
    const {CustomContent} = await import('../models/CustomContent')
    vi.mocked(CustomContent.createIndexes).mockRejectedValueOnce(new Error('Queue timeout')).mockResolvedValueOnce(undefined)
    const {ensureContentIndexes} = await import('./content-indexes')
    await expect(ensureContentIndexes()).rejects.toThrow('Queue timeout')
    await ensureContentIndexes()
    expect(CustomContent.createIndexes).toHaveBeenCalledTimes(2)
  })
})
