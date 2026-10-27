import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { CustomContent } from '../models/CustomContent'
import { Character } from '../models/Character'
import { requireAuth } from '../middleware/auth'
import { buildOrcbrewCatalog, ORCBREW_KINDS, sourceHash, type OrcbrewKind } from '../lib/orcbrew'
import { parsedPack } from '../lib/orcbrew-library'
import { activeWorkshopEntries } from '../lib/workshop-schema'
import { workshopLibrary } from '../lib/workshop-library'
import { enrichedMonsterEntries } from '../lib/monster-enrichment'
import { packSource,decodedPackData,storedPackData,MAX_STORED_PACK_BYTES,PLAIN_PACK_BYTES,MAX_PACK_BYTES } from '../lib/pack-storage'
import { monsterBrowseEntry } from '../lib/monster-browse'
import { readPackDocuments } from '../lib/pack-source'
import { ensureContentIndexes } from '../lib/content-indexes'
import { combinedOrcbrew } from '../lib/orcbrew-export'
import { itemBrowseEntry } from '../lib/orcbrew-items'

const router = Router()
router.use(requireAuth)

type ContentType = 'background' | 'feat' | 'spell' | 'orcbrew'
const TYPE_MAP: Record<string, ContentType> = {
  backgrounds: 'background', feats: 'feat', spells: 'spell', 'orcbrew-packs': 'orcbrew',
}
const createSchema = z.record(z.string(), z.any())
const orcbrewSchema = z.object({
  filename: z.string().min(1).max(255).regex(/\.orcbrew$/i),
  source: z.string().min(1).max(MAX_STORED_PACK_BYTES),
  sourceEncoding:z.literal('gzip-base64').optional(),
  sourceBytes:z.number().int().min(1).max(MAX_PACK_BYTES).optional(),
}).refine(v=>v.sourceEncoding?!!v.sourceBytes:Buffer.byteLength(v.source)<=PLAIN_PACK_BYTES,'Large files must use compressed upload')

function packSummary(doc: { _id: unknown; data: unknown }) {
  const data = doc.data as { filename: string; includeDisabled?: boolean }
  try {
    return { id: String(doc._id), filename: data.filename, includeDisabled: data.includeDisabled === true, report: parsedPack(data).report }
  } catch (error) {
    return { id: String(doc._id), filename: data.filename, error: error instanceof Error ? error.message : 'Could not read saved file' }
  }
}

router.get('/homebrew/:kind', async (req, res) => {
  const kind = req.params.kind as OrcbrewKind
  if (!ORCBREW_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown homebrew content type' })
  const entries=(await workshopLibrary(req.userId)).catalog[kind]
  if((kind==='equipment'||kind==='magic-items')&&req.query.view==='index')return res.json(entries.map(e=>itemBrowseEntry(e,kind)))
  if(kind==='monsters'&&req.query.view==='index')return res.json(entries.map(monsterBrowseEntry))
  res.json(kind==='monsters'?await enrichedMonsterEntries(req.userId,entries):kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(entries,kind):entries)
})

router.get('/homebrew/items/:kind/:index',async(req,res)=>{
  if(req.params.kind!=='equipment'&&req.params.kind!=='magic-items')return res.status(404).json({error:'Item category not found.'})
  const entries=(await workshopLibrary(req.userId)).catalog[req.params.kind]
  const entry=entries.find(e=>e.index===req.params.index||(e.aliases as string[]??[]).includes(String(req.params.index)))
  if(!entry)return res.status(404).json({error:'Item not found.'})
  res.json(entry)
})

router.get('/homebrew/monsters/:index',async(req,res)=>{
  const entries=(await workshopLibrary(req.userId)).catalog.monsters
  const entry=entries.find(e=>e.index===req.params.index||(e.aliases as string[]??[]).includes(String(req.params.index)))
  if(!entry)return res.status(404).json({error:'Monster not found.'})
  res.json((await enrichedMonsterEntries(req.userId,[entry]))[0])
})

router.get('/orcbrew-packs/export-all',async(req,res)=>{
  const docs=await readPackDocuments(req.userId)
  if(!docs.length)return res.status(404).json({error:'There are no saved Orcbrew files to export.'})
  try{
    const source=combinedOrcbrew(docs.map(doc=>({filename:String((doc.data as Record<string,unknown>).filename),source:packSource(doc.data)})))
    res.attachment('All homebrew.orcbrew').type('application/octet-stream').send(Buffer.from(source,'utf8'))
  }catch(error){res.status(422).json({error:error instanceof Error?error.message:'Could not combine your Orcbrew files.'})}
})

router.get('/orcbrew-packs/:id/export', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file ID' })
  const doc = (await readPackDocuments(req.userId,String(req.params.id)))[0]
  if (!doc) return res.status(404).json({ error: 'File not found' })
  const data = doc.data as { filename: string; source: string }
  res.attachment(data.filename).type('application/octet-stream').send(Buffer.from(packSource(data), 'utf8'))
})

router.patch('/orcbrew-packs/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file ID' })
  const parsed = z.object({ includeDisabled: z.boolean() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid file settings' })
  const doc = await CustomContent.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, type: 'orcbrew' },
    { $set: { 'data.includeDisabled': parsed.data.includeDisabled } }, { new: true },
  ).lean()
  if (!doc) return res.status(404).json({ error: 'File not found' })
  res.json(packSummary(doc))
})

router.get('/:type', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  const items = type==='orcbrew'?await readPackDocuments(req.userId):await CustomContent.find({ userId: req.userId, type }).lean()
  res.json(type === 'orcbrew' ? items.map(packSummary) : items.map((item) => ({ ...(item.data as Record<string, unknown>), id: item._id })))
})

router.post('/:type', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  if (type !== 'orcbrew') {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
    const doc = await CustomContent.create({ userId: req.userId, type, data: parsed.data })
    return res.status(201).json({ ...parsed.data, id: doc._id })
  }
  const parsed = orcbrewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid Orcbrew file' })
  let decoded:ReturnType<typeof decodedPackData>
  try{decoded=decodedPackData(parsed.data)}catch(error){return res.status(400).json({error:(error as Error).message})}
  const hash = sourceHash(decoded.source)
  let existing = await CustomContent.findOne({ userId: req.userId, type, sourceHash: hash }).lean()
  if (!existing) {
    const legacy = await CustomContent.find({ userId: req.userId, type, sourceHash: { $exists: false } }).lean()
    existing = legacy.find((doc) => {try{return sourceHash(packSource(doc.data))===hash}catch{return false}}) ?? null
  }
  if (existing) return res.status(200).json({ ...packSummary(existing), duplicate: true })
  let data:Record<string,unknown>
  try {
    parsedPack(decoded)
    data=storedPackData({...decoded,includeDisabled:false})
  } catch (error) {
    return res.status(400).json({ error: `Could not read Orcbrew file: ${error instanceof Error ? error.message : 'Invalid data'}` })
  }
  try {
    // Store the original once. Derived entries are cached instead of duplicating multi-megabyte files in MongoDB.
    await ensureContentIndexes()
    const doc = await CustomContent.create({ userId: req.userId, type, sourceHash: hash, data })
    return res.status(201).json({ ...packSummary(doc), duplicate: false })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    const duplicate = await CustomContent.findOne({ userId: req.userId, type, sourceHash: hash }).lean()
    if (!duplicate) throw error
    return res.status(200).json({ ...packSummary(duplicate), duplicate: true })
  }
})

// Replace in place so character references and the pack identity remain stable.
router.post('/orcbrew-packs/:id/replace',async(req,res)=>{
  const body=z.object({pack:orcbrewSchema,expectedHash:z.string().length(64)}).strict().safeParse(req.body)
  if(!isValidObjectId(req.params.id)||!body.success)return res.status(400).json({error:'Supply a valid pack and its current source hash.'})
  const doc=(await readPackDocuments(req.userId,String(req.params.id)))[0]
  if(!doc)return res.status(404).json({error:'Pack not found.'})
  try{
    if(sourceHash(packSource(doc.data))!==body.data.expectedHash)return res.status(409).json({error:'The pack changed. Download the current version before replacing it.'})
    const decoded=decodedPackData(body.data.pack),parsed=parsedPack(decoded),hash=sourceHash(decoded.source)
    const data=storedPackData({...doc.data as Record<string,unknown>,...decoded,sourceEncoding:undefined,sourceBytes:undefined})
    const saved=await CustomContent.findOneAndUpdate({_id:doc._id,userId:req.userId,type:'orcbrew',updatedAt:doc.updatedAt},{$set:{data,sourceHash:hash}},{new:true}).lean()
    if(!saved)return res.status(409).json({error:'The pack changed while saving. Reload before trying again.'})
    res.json({id:String(saved._id),filename:decoded.filename,hash,report:parsed.report})
  }catch(error){res.status((error as {code?:number}).code===11000?409:400).json({error:(error as Error).message})}
})

router.put('/:type/:id', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  if (type === 'orcbrew') return res.status(405).json({ error: 'Import the revised Orcbrew file to add a new version' })
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid content ID' })
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const doc = await CustomContent.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, type }, { $set: { data: parsed.data } }, { new: true },
  ).lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json({ ...parsed.data, id: doc._id })
})

router.delete('/:type/:id', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid content ID' })
  if (type === 'orcbrew') {
    const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type }).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    let entries: ReturnType<typeof buildOrcbrewCatalog>['spells'] = []
    try {
      const data = doc.data as { filename: string }
      entries = buildOrcbrewCatalog([{ id: String(doc._id), filename: data.filename, includeDisabled: true, parsed: parsedPack(data) }]).spells
    } catch {
      // Corrupt legacy files can still be removed.
    }
    const replacements = entries.flatMap((entry) => (entry.aliases as string[]).map((alias) => ({ alias, index: entry.index })))
    if (replacements.length) {
      const remap = (field: string) => ({ $map: {
        input: { $ifNull: [`$spellcasting.${field}`, []] }, as: 'spell', in: { $switch: {
          branches: replacements.map(({ alias, index }) => ({ case: { $eq: ['$$spell', alias] }, then: index })), default: '$$spell',
        } },
      } })
      // Convert old file-scoped references before removal so surviving overlapping packs keep resolving them.
      await Character.collection.updateMany({
        userId: doc.userId,
        $or: [
          { 'spellcasting.prepared': { $in: replacements.map((item) => item.alias) } },
          { 'spellcasting.known': { $in: replacements.map((item) => item.alias) } },
        ],
      }, [{ $set: { 'spellcasting.prepared': remap('prepared'), 'spellcasting.known': remap('known') } }])
    }
  }
  const result = await CustomContent.deleteOne({ _id: req.params.id, userId: req.userId, type })
  if (!result.deletedCount) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

export default router
