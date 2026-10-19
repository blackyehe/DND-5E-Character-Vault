import { Router } from 'express'
import { createHash } from 'node:crypto'
import { requireAuth } from '../middleware/auth'
import { CustomContent } from '../models/CustomContent'
import { Character } from '../models/Character'
import { isValidObjectId } from 'mongoose'
import { savedCharacterOutput } from '../lib/character-output'
import { applyItemTemplate,grantSchema,prepareItem } from '../lib/inventory'
import type { EquipmentItem } from '../../shared/character'

const router=Router()
router.use(requireAuth)
export async function rememberItem(userId:string|undefined,requestId:string,item:EquipmentItem) {
  const id=createHash('sha256').update(`${userId}:item:${requestId}`).digest('hex').slice(0,24)
  const data=JSON.parse(JSON.stringify({...item,qty:1,equipped:false,attuned:false,grantId:undefined,templateId:id,templateRevision:0}))
  await CustomContent.updateOne({_id:id,userId,type:'item'},{$setOnInsert:{userId,type:'item',data}},{upsert:true,runValidators:true})
  return id
}
router.get('/',async(req,res)=>{
  const records=await CustomContent.find({userId:req.userId,type:'item'}).select('_id data __v').sort({'data.name':1}).lean()
  res.json(records.map(r=>({id:String(r._id),revision:r.__v??0,item:{...prepareItem(r.data as EquipmentItem),templateId:String(r._id),templateRevision:r.__v??0}})))
})
router.post('/',async(req,res)=>{
  const parsed=grantSchema.safeParse(req.body)
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Check the item details.'})
  const item=prepareItem(parsed.data.item),id=await rememberItem(req.userId,parsed.data.requestId,item)
  res.status(201).json({id,item:{...item,templateId:id}})
})
router.put('/:id',async(req,res)=>{
  const parsed=grantSchema.safeParse(req.body)
  if(!isValidObjectId(req.params.id)||!parsed.success)return res.status(400).json({error:'Check the saved item and its details.'})
  const item=prepareItem(parsed.data.item)
  const record=await CustomContent.findOneAndUpdate({_id:req.params.id,userId:req.userId,type:'item'},{$set:{data:JSON.parse(JSON.stringify({...item,qty:1,equipped:false,attuned:false,templateId:req.params.id}))},$inc:{__v:1}},{new:true,runValidators:true}).lean()
  if(!record)return res.status(404).json({error:'Item not found in your library.'})
  const characters=await Character.find({userId:req.userId,'equipment.templateId':String(record._id)}).select('_id').lean()
  let updated=0,deferred=0
  for(const target of characters){
    let complete=false
    for(let attempt=0;attempt<6;attempt++){
      const [raw,latest]=await Promise.all([Character.findOne({_id:target._id,userId:req.userId}).lean(),CustomContent.findOne({_id:record._id,userId:req.userId,type:'item'}).lean()])
      if(!raw||!latest){complete=true;break}
      const before=savedCharacterOutput(raw),definition=prepareItem(latest.data as EquipmentItem),revision=latest.__v??0
      const equipment=applyItemTemplate(before.equipment,definition,String(record._id),revision)
      if(JSON.stringify(equipment)===JSON.stringify(before.equipment)){complete=true;break}
      const result=await Character.updateOne({_id:raw._id,userId:req.userId,updatedAt:raw.updatedAt},{$set:{equipment,'combat.itemAcBaseline':before.combat.itemAcBaseline}})
      if(result.modifiedCount){updated++;complete=true;break}
    }
    if(!complete)deferred++
  }
  const count=`${updated} character${updated===1?'':'s'} updated`
  res.json({id:String(record._id),item,updated,deferred,message:deferred?`Item saved; ${count}. ${deferred} busy sheets need another save to retry.`:`Item saved; ${count}.`})
})
export default router
