import { env } from '../env'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { Character } from '../models/Character'
import { dmvImportCatalog } from '../lib/dmv-catalog'
import { dmvCharacterUrl, fetchDmvCharacter, previewDmvCharacter, DmvImportError } from '../lib/dmv-import'

const router = Router()
router.use(requireAuth)
const requestSchema = z.object({
  url: z.string().max(2048).optional(),
  source: z.string().min(1).refine((value) => Buffer.byteLength(value, 'utf8') <= 4 * 1024 * 1024, 'Character data must be 4 MB or smaller.').optional(),
}).refine((value) => !!value.url !== !!value.source, 'Provide either a character link or character data.')

router.post('/dmv/preview', async (req, res) => {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid import request.' })
  try {
    if (parsed.data.url) dmvCharacterUrl(parsed.data.url)
    const input = parsed.data.url ? await fetchDmvCharacter(parsed.data.url) : { source: parsed.data.source!, sourceUrl: '' }
    const started=performance.now(),{catalog,reader}=await dmvImportCatalog(req.userId),catalogMs=performance.now()-started
    const rulesStarted=performance.now(),preview = await previewDmvCharacter(input.source, input.sourceUrl, catalog, env.SRD_API_URL),rulesMs=performance.now()-rulesStarted
    // Validate against the real sheet schema without saving or claiming the source identity.
    await new Character({ ...preview.character, userId: req.userId }).validate()
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Dmv-Catalog-Reader',reader)
    res.setHeader('X-Dmv-Stage-Timing',`import-catalog;dur=${catalogMs.toFixed(1)}, import-rules;dur=${rulesMs.toFixed(1)}`)
    return res.json(preview)
  } catch (error) {
    if (error instanceof DmvImportError) return res.status(error.status).json({ error: error.message,...error.sourceStatus===undefined?{}:{sourceStatus:error.sourceStatus} })
    throw error
  }
})
export default router
