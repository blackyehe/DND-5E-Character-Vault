import { Router } from 'express'
import { z } from 'zod'
import { Character } from '../models/Character'
import { requireAuth } from '../middleware/auth'
import { normalizeImportedCharacter } from '../../shared/weapon-proficiencies'
import { resolveWorkshopCharacter, workshopLibrary, workshopRevision } from '../lib/workshop-library'

import { characterOutput as output, savedCharacterOutput, quickSheetOutput } from '../lib/character-output'
import { sheetReferences } from '../lib/sheet-references'
import { grantSchema,inventoryAfterGrant } from '../lib/inventory'
import { rememberItem } from './items'
import { attunementError } from '../../shared/item-rules'
import { resolveEquipmentItem } from '../lib/equipment-references'
import { CustomContent } from '../models/CustomContent'

const router = Router()
router.use(requireAuth)

const SUMMARY_FIELDS =
  'meta.name meta.race meta.klass meta.level meta.subclass meta.background meta.portrait companionKind updatedAt'

router.get('/', async (req, res) => {
  const chars = await Character.find({ userId: req.userId })
    .select(SUMMARY_FIELDS)
    .sort({ updatedAt: -1 })
    .lean()
  res.json(chars)
})

router.get('/champions', async (req, res) => {
  const champions = await Character.find({ userId:req.userId, companionKind:'shadow-champion' }).select(SUMMARY_FIELDS).sort({ 'meta.name':1 }).lean()
  res.json(champions)
})

router.post('/', async (req, res) => {
  const { _id, userId, createdAt, updatedAt, __v, ...data } = req.body
  const candidate=new Character({...normalizeImportedCharacter(data),userId:req.userId})
  const resolved=await resolveWorkshopCharacter(candidate.toObject(),req.userId)
  const char = await Character.create({ ...resolved, userId: req.userId })
  res.status(201).json(await output(char.toObject(),req.userId))
})

router.get('/:id', async (req, res) => {
  const char = await Character.findOne({ _id: req.params.id, userId: req.userId }).lean()
  if (!char) return res.status(404).json({ error: 'Character not found' })
  res.json(req.query.view==='quick'?{...quickSheetOutput(char),libraryRevision:await workshopRevision(req.userId)}:await output(char,req.userId))
})
router.get('/:id/references',async(req,res)=>{
  const character=await Character.findOne({_id:req.params.id,userId:req.userId}).lean()
  if(!character)return res.status(404).json({error:'Character not found'})
  const library=await workshopLibrary(req.userId)
  const resolved=await resolveWorkshopCharacter(character,req.userId,library)
  res.json({...sheetReferences(resolved,library),character:savedCharacterOutput(resolved)})
})
router.get('/:id/spell-options',async(req,res)=>{
  if(!await Character.exists({_id:req.params.id,userId:req.userId}))return res.status(404).json({error:'Character not found'})
  const library=await workshopLibrary(req.userId)
  res.json(library.catalog.spells.map(({index,name,displayName,sourcePack,level,contentKey,aliases,desc})=>({index,name,displayName,sourcePack,level,contentKey,aliases,definitionAvailable:Array.isArray(desc)&&desc.some(line=>typeof line==='string'&&line.trim())})))
})

// Inventory delivery is independent of rule-library loading and permanent edits.
router.post('/:id/items',async(req,res)=>{
  const parsed=grantSchema.safeParse(req.body)
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Check the item details.'})
  let item=parsed.data.item
  if(item.templateId){const source=await CustomContent.findOne({_id:item.templateId,userId:req.userId,type:'item'}).lean();if(!source)return res.status(404).json({error:'That item template is no longer in your library.'});item={...source.data as typeof item,templateId:String(source._id),templateRevision:source.__v??0,qty:item.qty,equipped:item.equipped,attuned:item.attuned}}
  for(let attempt=0;attempt<4;attempt++){
    const raw=await Character.findOne({_id:req.params.id,userId:req.userId}).lean()
    if(!raw)return res.status(404).json({error:'Character not found.'})
    const before=savedCharacterOutput(raw)
    let result:ReturnType<typeof inventoryAfterGrant>
    try{result=inventoryAfterGrant(before,item,parsed.data.requestId)}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Could not give that item.'})}
    if(result.duplicate)return res.json({character:before,message:`${item.name} was already delivered.`})
    if(parsed.data.remember){const id=await rememberItem(req.userId,parsed.data.requestId,item);item={...item,templateId:id};result=inventoryAfterGrant(before,item,parsed.data.requestId)}
    const saved=await Character.findOneAndUpdate({_id:raw._id,userId:req.userId,updatedAt:raw.updatedAt},{$set:{equipment:result.equipment,'combat.itemAcBaseline':before.combat.itemAcBaseline}},{new:true,runValidators:true}).lean()
    if(saved)return res.status(201).json({character:savedCharacterOutput(saved),message:`${item.name} given to ${before.meta.name}.`})
  }
  res.status(409).json({error:'This inventory is changing quickly. Try Give item again; the same delivery will not be duplicated.'})
})
router.get('/:id/advancement-options',async(req,res)=>{
  const character=await Character.findOne({_id:req.params.id,userId:req.userId}).lean()
  if(!character)return res.status(404).json({error:'Character not found'})
  const library=await workshopLibrary(req.userId)
  res.set('Cache-Control','no-store').json({character:savedCharacterOutput(await resolveWorkshopCharacter(character,req.userId,library)),libraryRevision:await workshopRevision(req.userId),rules:library.rules.map(r=>({index:r.index,name:r.draft.name,url:'',workshop:r.draft})),classes:library.catalog.classes.map(({details,...entry})=>entry),subclasses:library.catalog.subclasses.map(({details,...entry})=>entry),feats:library.catalog.feats.map(({details,...entry})=>entry),spells:library.catalog.spells.map(({index,name,displayName,sourcePack,level,contentKey,aliases})=>({index,name,displayName,sourcePack,level,contentKey,aliases,url:''}))})
})
router.get('/:id/editor-options',async(req,res)=>{
  if(!await Character.exists({_id:req.params.id,userId:req.userId}))return res.status(404).json({error:'Character not found'})
  const library=await workshopLibrary(req.userId)
  res.json({rules:library.rules.map(r=>({index:r.index,name:r.draft.name,url:'',workshop:r.draft})),feats:library.catalog.feats.map(({details,...entry})=>entry),spells:library.catalog.spells.map(({index,name,displayName,sourcePack,level,contentKey,aliases,desc})=>({index,name,displayName,sourcePack,level,contentKey,aliases,definitionAvailable:Array.isArray(desc)&&desc.some(line=>typeof line==='string'&&line.trim())}))})
})
router.get('/:id/spell-definition/:index',async(req,res)=>{
  if(!await Character.exists({_id:req.params.id,userId:req.userId}))return res.status(404).json({error:'Character not found'})
  const library=await workshopLibrary(req.userId)
  const entry=library.catalog.spells.find(s=>s.index===req.params.index||(s.aliases as string[]).includes(String(req.params.index)))
  if(!entry)return res.status(404).json({error:'Spell definition not found'})
  const {details,...spell}=entry;if(!Array.isArray(spell.desc)||!spell.desc.some(line=>typeof line==='string'&&line.trim()))return res.status(404).json({error:'This imported spell has no rules definition. Choose a matching SRD or another homebrew definition.'});res.json(spell)
})

router.patch('/:id', async (req, res) => {
  if(req.body.expectedLibraryRevision&&req.body.expectedLibraryRevision!==await workshopRevision(req.userId))return res.status(409).json({error:'Saved rules changed during this advancement. Reload the latest character and restart.'})
  const library=await workshopLibrary(req.userId)
  const fields=['companionKind','meta','combat','abilities','saves','skills','attacks','equipment','spellcasting','personality','features','resources','proficiencies','homebrew']
  const patch=Object.fromEntries(fields.filter(key=>Object.hasOwn(req.body,key)).map(key=>[key,req.body[key]]))
  for(let attempt=0;attempt<3;attempt++){
    const before=await Character.findOne({_id:req.params.id,userId:req.userId}).lean()
    if(!before)return res.status(404).json({error:'Character not found'})
    if(req.body.expectedUpdatedAt && new Date(before.updatedAt).toISOString() !== req.body.expectedUpdatedAt)return res.status(409).json({error:'This sheet changed elsewhere. Refresh before repeating your changes.'})
    const previous=savedCharacterOutput(before)
    if(patch.equipment){patch.equipment=(patch.equipment as typeof previous.equipment).map(resolveEquipmentItem);const equipment=patch.equipment as typeof previous.equipment;if(equipment.some(i=>i.attuned&&!previous.equipment.some(old=>String(old._id)===String(i._id)&&old.attuned))){const issue=attunementError(equipment);if(issue)return res.status(400).json({error:issue})}}
    const combatPatch=patch.combat as Partial<typeof previous.combat>|undefined
    const resolved=await resolveWorkshopCharacter({...before,...patch,combat:{...before.combat,...combatPatch,itemAcBaseline:combatPatch?.itemAcBaseline??previous.combat.itemAcBaseline}},req.userId,library)
    const {meta,features,resources,spellcasting,proficiencies,saves,skills,homebrew}=resolved
    const char=await Character.findOneAndUpdate({_id:before._id,userId:req.userId,updatedAt:before.updatedAt},{$set:{...patch,meta,features,resources,spellcasting,proficiencies,saves,skills,homebrew,...(patch.combat?{combat:resolved.combat}:{'combat.hpMax':resolved.combat.hpMax,'combat.speed':resolved.combat.speed,'combat.itemAcBaseline':resolved.combat.itemAcBaseline})}},{new:true,runValidators:true}).lean()
    if(char)return res.json(await output(char,req.userId))
  }
  res.status(409).json({error:'This character changed while saving. Your edits have been kept; refresh the character before trying again.'})
})

router.delete('/:id', async (req, res) => {
  const result = await Character.deleteOne({ _id: req.params.id, userId: req.userId })
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Character not found' })
  res.json({ ok: true })
})

router.post('/:id/duplicate', async (req, res) => {
  const original = await Character.findOne({ _id: req.params.id, userId: req.userId }).lean()
  if (!original) return res.status(404).json({ error: 'Character not found' })
  const { _id, createdAt, updatedAt, __v, ...rest } = original as any
  delete rest.userId
  const copy = await Character.create({
    ...rest,
    userId: req.userId,
    meta: { ...rest.meta, name: `${rest.meta?.name ?? 'Character'} (copy)` },
  })
  res.status(201).json(copy)
})

router.get('/:id/export', async (req, res) => {
  const char = await Character.findOne({ _id: req.params.id, userId: req.userId }).lean()
  if (!char) return res.status(404).json({ error: 'Character not found' })
  const name = (char.meta as any)?.name ?? 'character'
  const filename = `${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(JSON.stringify(await output(char,req.userId), null, 2))
})

const importSchema = z.record(z.string(), z.any())

router.post('/import', async (req, res) => {
  const parsed = importSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid JSON' })
  const data: any = parsed.data
  // strip identity fields so we never import another user's id
  delete data._id
  delete data.userId
  delete data.createdAt
  delete data.updatedAt
  delete data.__v
  const char = await Character.create({ userId: req.userId, ...normalizeImportedCharacter(data, true) })
  res.status(201).json(char)
})

export default router
