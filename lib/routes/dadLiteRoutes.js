import { db, requireDadLite } from '../firebaseAdmin.js'
function monthOk(month){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)}
function dateOk(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)}
function applicationNumber(){return `RENT-${Date.now().toString().slice(-8)}-${Math.floor(1000+Math.random()*9000)}`}
const RECEIVERS = new Set(['Deepu','Rajavel','Dada','Siva','Brother'])

export async function roster(req,res){
  res.setHeader('Cache-Control','no-store'); await requireDadLite(req)
  const month=String(req.body?.month||'').trim(); if(!monthOk(month)) return res.status(400).json({error:'Invalid month'})
  const housesSnap=await db.collection('houses').get(); const houses=housesSnap.docs.map(d=>{const h=d.data(); if(String(h.status||'').trim().toLowerCase()!=='occupied') return null; return {id:d.id,internalDoorNumber:h.internalDoorNumber||'',govtDoorNumber:h.govtDoorNumber||'',tenantName:h.tenantName||'Tenant',rentAmount:Number(h.rentAmount||0),currentTenantId:h.currentTenantId||null}}).filter(Boolean)
  if(!houses.length) return res.status(200).json({houses:[],payments:[]})
  const paymentsSnap=await db.collection('rentPayments').where('month','==',month).get(); const allowed=new Set(houses.map(h=>h.id)); const payments=paymentsSnap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>allowed.has(p.houseId)).map(p=>({id:p.id,houseId:p.houseId,status:p.status,dateSent:p.dateSent||null,cashReceivedBy:p.cashReceivedBy||null,submittedAt:p.submittedAt||0,entrySource:p.entrySource||null}))
  return res.status(200).json({houses,payments})
}

export async function submitRent(req,res){
  res.setHeader('Cache-Control','no-store'); const {decoded,profile}=await requireDadLite(req)
  const houseId=String(req.body?.houseId||'').trim(), month=String(req.body?.month||'').trim(), dateSent=String(req.body?.dateSent||'').trim(), receiver=String(req.body?.cashReceivedBy||'').trim()
  if(!houseId||!monthOk(month)||!dateOk(dateSent)||!receiver) return res.status(400).json({error:'House, month, payment date and receiver are required.'})
  if(receiver==='Others'){const other=String(req.body?.otherReceiver||'').trim();if(!other||other.length>80)return res.status(400).json({error:'Enter the receiver name.'})}else if(!RECEIVERS.has(receiver))return res.status(400).json({error:'Invalid receiver.'})
  const houseSnap=await db.collection('houses').doc(houseId).get(); if(!houseSnap.exists)return res.status(404).json({error:'House not found.'}); const house=houseSnap.data()
  if(house.status!=='occupied'||!house.currentTenantId)return res.status(400).json({error:'This house is not currently occupied.'})
  const amount=Number(house.rentAmount||0); if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'This house does not have a valid rent amount.'})
  const existing=await db.collection('rentPayments').where('houseId','==',houseId).where('month','==',month).get(); if(existing.docs.some(d=>['waiting_approval','approved'].includes(d.data().status)))return res.status(409).json({error:'Rent is already marked as paid or waiting for approval.'})
  const finalReceiver=receiver==='Others'?String(req.body?.otherReceiver||'').trim().slice(0,80):receiver; const appNo=applicationNumber(); const data={houseId,tenantId:house.currentTenantId,month,amount,dateSent,mode:'cash',cashReceivedBy:finalReceiver,neighborHouseId:null,neighborCollectedBy:null,proofUrl:null,applicationNumber:appNo,status:'waiting_approval',uploadedByOwner:true,recordedBy:{uid:decoded.uid,name:profile.name||'Owner'},entrySource:'dad_lite',rejectionReason:null,submittedAt:Date.now(),approvedAt:null,actionedBy:null}
  const ref=await db.collection('rentPayments').add(data); await db.collection('activityLog').add({action:'submitted',entityType:'rent',entityId:ref.id,performedBy:decoded.uid,performedByName:profile.name||'Dad Lite',details:`Dad Lite submitted rent for ${house.internalDoorNumber||houseId} for ${month}`,timestamp:Date.now()})
  return res.status(200).json({applicationNumber:appNo})
}
