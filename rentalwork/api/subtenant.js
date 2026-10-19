import { create, list, update, remove } from '../lib/routes/subtenantRoutes.js'
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
  try { const action=String(req.body?.action||'list'); if(action==='create') return await create(req,res); if(action==='update') return await update(req,res); if(action==='delete') return await remove(req,res); return await list(req,res) }
  catch(err){ return res.status(err.statusCode||500).json({error:err.message||'Family account request failed'}) }
}
