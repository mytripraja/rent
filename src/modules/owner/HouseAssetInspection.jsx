import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Plus, Trash2, Save, ShieldCheck, AlertTriangle, CheckCircle2, Wrench, PackageCheck } from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { createHouseInspection, deleteHouseAsset, listHouseAssets, listHouseInspections, saveHouseAsset } from '../../services/houseAssetService'
import { useAuth } from '../../context/AuthContext'

const CONDITIONS = ['good','minor-wear','repair-needed','missing','replaced']
const TYPES = ['Fixture','Appliance','Electrical','Plumbing','Furniture','Safety','Other']
const CHECK_TYPES = ['Move-in','Routine','Vacate','Repair follow-up']

export default function HouseAssetInspection() {
  const { user } = useAuth()
  const owner = user?.role === 'owner' || user?.role === 'admin'
  const [houses, setHouses] = useState([])
  const [houseId, setHouseId] = useState('')
  const [assets, setAssets] = useState([])
  const [inspections, setInspections] = useState([])
  const [draft, setDraft] = useState({ name:'', category:'Fixture', quantity:1, condition:'good', notes:'' })
  const [inspection, setInspection] = useState({ type:'Routine', inspectedAt:new Date().toISOString().slice(0,10), notes:'', items:[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { listHouses().then(h => { setHouses(h); if (h[0]) setHouseId(h[0].id) }).catch(e => setError(e.message)) }, [])
  useEffect(() => { if (!houseId) return; Promise.all([listHouseAssets(houseId), listHouseInspections(houseId)]).then(([a,i]) => { setAssets(a); setInspections(i); setInspection(v => ({ ...v, items: a.map(x => ({ assetId:x.id, name:x.name, condition:x.condition || 'good', notes:'' })) })) }).catch(e => setError(e.message)) }, [houseId])

  const selectedHouse = houses.find(h => h.id === houseId)
  const openIssues = useMemo(() => assets.filter(a => ['repair-needed','missing'].includes(a.condition)), [assets])

  async function addAsset() {
    setError(''); if (!draft.name.trim() || !houseId) return
    try { const id = await saveHouseAsset(houseId, draft); setAssets(await listHouseAssets(houseId)); setDraft({ name:'', category:'Fixture', quantity:1, condition:'good', notes:'' }) } catch(e) { setError(e.message) }
  }
  async function removeAsset(id) { try { await deleteHouseAsset(houseId, id); setAssets(await listHouseAssets(houseId)) } catch(e) { setError(e.message) } }
  async function updateAsset(id, patch) { const item = assets.find(x => x.id === id); if (!item) return; try { await saveHouseAsset(houseId, { ...item, ...patch }); setAssets(await listHouseAssets(houseId)) } catch(e) { setError(e.message) } }
  async function saveInspection() {
    if (!houseId) return
    setSaving(true); setError('')
    try { await createHouseInspection(houseId, inspection); setInspections(await listHouseInspections(houseId)); setInspection(v => ({ ...v, notes:'', items:assets.map(x => ({ assetId:x.id, name:x.name, condition:x.condition || 'good', notes:'' })) })) } catch(e) { setError(e.message) } finally { setSaving(false) }
  }

  if (!owner) return <div className="rm-card p-5"><ShieldCheck className="text-brand mb-2"/><h2 className="font-display text-xl font-bold text-ink">House asset history</h2><p className="text-sm text-ink-soft mt-1">Only the property owner can edit assets and inspections.</p></div>

  return <div className="space-y-5">
    <div className="rm-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div><div className="rm-kicker">Property records</div><h2 className="font-display text-2xl font-extrabold mt-1">House Assets & Inspection</h2><p className="text-sm text-ink-soft mt-1">Keep a practical record of what belongs to each house and its condition over time.</p></div>
        <select value={houseId} onChange={e=>setHouseId(e.target.value)} className="w-full sm:w-80"><option value="">Select house</option>{houses.map(h=><option key={h.id} value={h.id}>{h.internalDoorNumber || h.id} · {h.tenantName || 'Vacant'}</option>)}</select>
      </div>
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>

    {selectedHouse && <>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rm-card p-4"><PackageCheck className="text-brand" size={18}/><p className="text-xs text-ink-soft mt-2">Tracked assets</p><p className="text-2xl font-bold text-ink">{assets.length}</p></div>
        <div className="rm-card p-4"><AlertTriangle className="text-amber-600" size={18}/><p className="text-xs text-ink-soft mt-2">Needs attention</p><p className="text-2xl font-bold text-ink">{openIssues.length}</p></div>
        <div className="rm-card p-4"><ClipboardCheck className="text-brand" size={18}/><p className="text-xs text-ink-soft mt-2">Inspections</p><p className="text-2xl font-bold text-ink">{inspections.length}</p></div>
      </div>

      <section className="rm-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-ink">Asset register</h3><p className="text-xs text-ink-soft">Fans, lights, bells, appliances, plumbing and anything supplied with the house.</p></div><Wrench className="text-brand"/></div>
        <div className="grid sm:grid-cols-[1fr_150px_90px_1fr_auto] gap-2 mt-4 items-end">
          <label className="text-xs font-semibold text-ink-soft">Item<input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} placeholder="Ceiling fan"/></label>
          <label className="text-xs font-semibold text-ink-soft">Category<select value={draft.category} onChange={e=>setDraft(v=>({...v,category:e.target.value}))}>{TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="text-xs font-semibold text-ink-soft">Qty<input type="number" min="1" value={draft.quantity} onChange={e=>setDraft(v=>({...v,quantity:Number(e.target.value||1)}))}/></label>
          <label className="text-xs font-semibold text-ink-soft">Notes<input value={draft.notes} onChange={e=>setDraft(v=>({...v,notes:e.target.value}))} placeholder="Remote included"/></label>
          <button onClick={addAsset} className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand text-white px-3 py-2.5 text-sm font-bold"><Plus size={15}/> Add</button>
        </div>
        <div className="mt-4 space-y-2">{assets.map(a=><div key={a.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_110px_1fr_auto] gap-2 items-center rounded-xl border border-[var(--rm-border)] p-3"><div><p className="font-semibold text-ink">{a.name}</p><p className="text-xs text-ink-soft">{a.category} · Qty {a.quantity}</p></div><select value={a.condition || 'good'} onChange={e=>updateAsset(a.id,{condition:e.target.value})}>{CONDITIONS.map(x=><option key={x} value={x}>{x.replace('-', ' ')}</option>)}</select><input type="number" min="1" value={a.quantity} onChange={e=>updateAsset(a.id,{quantity:Number(e.target.value||1)})}/><input value={a.notes || ''} onChange={e=>updateAsset(a.id,{notes:e.target.value})} placeholder="Notes"/><button onClick={()=>removeAsset(a.id)} className="p-2 text-red-600" aria-label={`Delete ${a.name}`}><Trash2 size={16}/></button></div>)}{assets.length===0&&<p className="py-8 text-center text-sm text-ink-soft">No assets recorded yet.</p>}</div>
      </section>

      <section className="rm-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-ink">New inspection</h3><p className="text-xs text-ink-soft">Record the condition at move-in, during a routine visit, after repairs or at vacating.</p></div><ClipboardCheck className="text-brand"/></div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4"><label className="text-xs font-semibold text-ink-soft">Inspection type<select value={inspection.type} onChange={e=>setInspection(v=>({...v,type:e.target.value}))}>{CHECK_TYPES.map(x=><option key={x}>{x}</option>)}</select></label><label className="text-xs font-semibold text-ink-soft">Date<input type="date" value={inspection.inspectedAt} onChange={e=>setInspection(v=>({...v,inspectedAt:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">Summary<input value={inspection.notes} onChange={e=>setInspection(v=>({...v,notes:e.target.value}))} placeholder="Everything checked"/></label></div>
        <div className="mt-4 space-y-2">{inspection.items.map((item,i)=><div key={`${item.assetId}-${i}`} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_1fr] gap-2 items-center rounded-xl bg-paper p-3 border border-[var(--rm-border)]"><div><p className="font-semibold text-ink">{item.name}</p></div><select value={item.condition} onChange={e=>setInspection(v=>({...v,items:v.items.map((x,j)=>j===i?{...x,condition:e.target.value}:x)}))}>{CONDITIONS.map(x=><option key={x}>{x.replace('-', ' ')}</option>)}</select><input value={item.notes || ''} onChange={e=>setInspection(v=>({...v,items:v.items.map((x,j)=>j===i?{...x,notes:e.target.value}:x)}))} placeholder="Inspection note"/></div>)}</div>
        <button onClick={saveInspection} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Save size={16}/>{saving?'Saving…':'Save inspection'}</button>
      </section>

      <section className="rm-card p-4 sm:p-5"><div className="flex items-center gap-2"><CheckCircle2 className="text-brand" size={18}/><h3 className="font-display text-lg font-bold text-ink">Inspection history</h3></div><div className="mt-3 space-y-2">{inspections.map(i=><div key={i.id} className="rounded-xl border border-[var(--rm-border)] p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-ink">{i.type}</p><p className="text-xs text-ink-soft">{i.inspectedAt} · {i.notes || 'No summary'}</p></div><span className="text-xs font-bold text-brand">{(i.items || []).filter(x=>x.condition==='good').length}/{(i.items || []).length} good</span></div></div>)}{inspections.length===0&&<p className="py-6 text-sm text-ink-soft text-center">No inspections recorded yet.</p>}</div></section>
    </>}
  </div>
}
