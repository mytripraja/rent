import { roster, submitRent } from '../lib/routes/dadLiteRoutes.js'
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
  try { const action=String(req.body?.action||'roster'); return action==='submit-rent' ? await submitRent(req,res) : await roster(req,res) }
  catch(err){ console.error('dad-lite:',err); const status=err.statusCode||500; let message=err.message||'Dad Lite request failed'; if(status===500&&/FIREBASE_SERVICE_ACCOUNT_KEY|credential|private key/i.test(message)) message='Dad Lite service is not connected to Firebase Admin. Check FIREBASE_SERVICE_ACCOUNT_KEY in the Vercel Production environment.'; return res.status(status).json({error:message,code:status===401?'UNAUTHENTICATED':status===403?'FORBIDDEN':'DAD_LITE_FAILED'}) }
}
