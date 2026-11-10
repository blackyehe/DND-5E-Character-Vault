import {effectiveDefinitions,saveNativeDefinition} from '../lib/definition-editions'
import {z} from 'zod'
import { Router } from 'express'
import { createHash } from 'node:crypto'
import { requireAuth } from '../middleware/auth'
import { CustomContent } from '../models/CustomContent'
import { isValidObjectId } from 'mongoose'
import { grantSchema,prepareItem } from '../lib/inventory'
import type { EquipmentItem } from '../../shared/character'
import {withItemBenefitEdition} from '../lib/item-benefits'
import {itemDefinitionSnapshot} from '../../shared/item-definition'

const router=Router()
router.use(requireAuth)
export async function rememberItem(userId:string|undefined,requestId:string,item:EquipmentItem) {
  const id=createHash('sha256').update(`${userId}:item:${requestId}`).digest('hex').slice(0,24)
  const data=JSON.parse(JSON.stringify({...item,qty:1,equipped:false,attuned:false,grantId:undefined,templateBaseline:undefined,templateId:id,templateRevision:0}))
  await CustomContent.updateOne({_id:id,userId,type:'item'},{$setOnInsert:{userId,type:'item',data}},{upsert:true,runValidators:true})
  return id
}
router.get('/',async(req,res)=>{
  const records=await CustomContent.find({userId:req.userId,type:'item'}).select('_id data __v').sort({'data.name':1}).lean()
  const editions=await effectiveDefinitions(req.userId,records.map(r=>{const item=prepareItem(r.data as EquipmentItem);return {kind:item.magical?'magic-items':'equipment',source:{index:`workshop-item-${r._id}`,name:item.name,workshopItem:item}}}))
  const items=records.map((r,position)=>{
    const item=prepareItem(r.data as EquipmentItem),effective=editions[position]!
    const definition=withItemBenefitEdition(item,effective.entry)
    return {id:String(r._id),revision:r.__v??0,definitionRevision:effective.revision,item:{...definition,templateBaseline:itemDefinitionSnapshot(definition),templateId:String(r._id),templateRevision:r.__v??0}}
  })
  res.json(items)
})
router.post('/',async(req,res)=>{
  const parsed=grantSchema.safeParse(req.body)
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Check the item details.'})
  const item=prepareItem(parsed.data.item),id=await rememberItem(req.userId,parsed.data.requestId,item)
  res.status(201).json({id,item:{...item,templateId:id}})
})
const updateSchema=grantSchema.extend({expectedRevision:z.number().int().min(0),expectedDefinitionRevision:z.number().int().min(0)})
router.put('/:id',async(req,res)=>{
  const parsed=updateSchema.safeParse(req.body)
  if(!isValidObjectId(req.params.id)||!parsed.success)return res.status(400).json({error:'Reopen this saved item before saving its changes.'})
  const record=await CustomContent.findOne({_id:req.params.id,userId:req.userId,type:'item'}).lean()
  if(!record)return res.status(404).json({error:'Item not found in your library.'})
  if((record.__v??0)!==parsed.data.expectedRevision)return res.status(409).json({error:'This item changed. Your draft is kept; reopen its saved version.'})
  const item=prepareItem(parsed.data.item),old=prepareItem(record.data as EquipmentItem),index=`workshop-item-${record._id}`,kind=item.magical?'magic-items':'equipment'
  const source=(value:EquipmentItem)=>({index,name:value.name,displayName:`${value.name} ? My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:value})
  const data=JSON.parse(JSON.stringify({...item,qty:1,equipped:false,attuned:false,templateId:String(record._id),templateRevision:(record.__v??0)+1}))
  const after=source(data)
  try{
    const result=await saveNativeDefinition(req.userId,kind,source(old),after,parsed.data.expectedDefinitionRevision,after,async session=>CustomContent.findOneAndUpdate({_id:record._id,userId:req.userId,type:'item',updatedAt:record.updatedAt,__v:record.__v??0},{$set:{data},$inc:{__v:1}},{new:true,runValidators:true,session}).lean())
    res.json({id:String(record._id),item:{...data,templateRevision:(record.__v??0)+1},definitionRevision:result.revision,message:'Item saved. Review affected characters to apply these changes.'})
  }catch(error){if((error as {status?:number;code?:number}).status===409||(error as {code?:number}).code===11000)return res.status(409).json({error:(error as Error).message});throw error}
})
export default router
