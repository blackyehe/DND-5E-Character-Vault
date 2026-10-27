import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { BROWSE_KINDS, queryBrowseIndex, type BrowseKind } from '../../shared/compendium-browse'
import { compendiumBrowseIndex, personalBrowseEntry } from '../lib/compendium-browse'

const router=Router()
router.use(requireAuth)
const querySchema=z.object({
  q:z.string().max(300).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),
  facets:z.string().max(4000).default('{}'),items:z.string().max(2000).default('{}'),
})
const filtersSchema=z.record(z.string().max(60),z.string().max(200))
router.param('kind',(_req,res,next,value)=>BROWSE_KINDS.includes(value as BrowseKind)?next():res.status(404).json({error:'Unknown Compendium category.'}))
router.get('/:kind',async(req,res)=>{
  const parsed=querySchema.safeParse(req.query)
  if(!parsed.success)return res.status(400).json({error:'Invalid search options.'})
  let facets:Record<string,string>,items:Record<string,string>
  try{facets=filtersSchema.parse(JSON.parse(parsed.data.facets));items=filtersSchema.parse(JSON.parse(parsed.data.items))}catch{return res.status(400).json({error:'Invalid search filters.'})}
  const kind=req.params.kind as BrowseKind
  const {index,revision}=await compendiumBrowseIndex(req.userId!,kind)
  res.json(queryBrowseIndex(index,kind,{query:parsed.data.q,page:parsed.data.page,facets,items:{category:'',weapon:'',damage:'',armour:'',...items}},revision))
})
router.get('/:kind/:index',async(req,res)=>{
  if(String(req.params.index).length>1000)return res.status(400).json({error:'Invalid entry reference.'})
  const entry=await personalBrowseEntry(req.userId!,req.params.kind as BrowseKind,String(req.params.index))
  return entry?res.json(entry):res.status(404).json({error:'This entry is no longer available in your library.'})
})
export default router
