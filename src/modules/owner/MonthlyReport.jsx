import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Search, RefreshCw, FileText } from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { listHouses } from '../../services/houseService'
import { listRentPaymentsForHouses } from '../../services/rentService'
import { useToast } from '../shared/ui/Toast'
import MonthlyFinancialReport from './MonthlyFinancialReport'

const money = value => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const shiftMonth = (month, delta) => { const [y,m] = month.split('-').map(Number); const d = new Date(y,m-1+delta,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
const monthLabel = month => { const [y,m] = month.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) }
const monthBounds = month => { const [y,m]=month.split('-').map(Number); return {start:new Date(y,m-1,1).getTime(),end:new Date(y,m,0,23,59,59,999)} }
const activeInMonth = (entry, month) => { const {start,end}=monthBounds(month); return Number(entry.movedInAt||0)<=end && (entry.movedOutAt==null || Number(entry.movedOutAt)>=start) }
const stamp = value => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) }

function statusFor(house, rows) {
  if (house.status !== 'occupied') return 'Vacant'
  const total = rows.filter(p=>p.status==='approved').reduce((s,p)=>s+(Number(p.amount)||0),0)
  if (rows.some(p => p.status === 'approved')) return Number(house.rentAmount)>0 && total < Number(house.rentAmount) ? 'Partial' : 'Paid'
  if (rows.some(p => p.status === 'waiting_approval')) return 'Waiting'
  return 'Unpaid'
}

export default function MonthlyReport() {
  const [view, setView] = useState('register')
  const [month, setMonth] = useState(currentMonth)
  const [houses, setHouses] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const payments = useMemo(()=>allPayments.filter(p=>p.month===month),[allPayments,month])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const toast = useToast()

  async function load({quiet=false}={}) {
    if (quiet) setRefreshing(true); else setLoading(true)
    try {
      const houseRows = await listHouses()
      const [rentRows, historyRows] = await Promise.all([
        listRentPaymentsForHouses(houseRows.map(h=>h.id)),
        Promise.all(houseRows.map(async h => { try { const snap=await getDocs(collection(db,'houses',h.id,'history')); return [h.id,snap.docs.map(d=>({id:d.id,...d.data()}))] } catch (error) { console.warn('Could not load occupancy history for rent register:',h.id,error?.message||error); return [h.id,[]] } }))
      ])
      setHouses(houseRows.map(h=>({...h,rentRegisterHistory:historyRows.find(([id])=>id===h.id)?.[1]||[]})))
      setAllPayments(rentRows)
    } catch (err) {
      console.error('Rent register load failed:',err)
      toast.error('Could not load the rent register. Please retry.')
    } finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(()=>{ load() },[])
  useEffect(()=>{ if(!loading) setFilter('All') },[month])

  const rows = useMemo(()=>houses.map(h=>{
    const own = payments.filter(p=>p.houseId===h.id)
    const approved = own.filter(p=>p.status==='approved')
    const waiting = own.filter(p=>p.status==='waiting_approval')
    const amount = approved.reduce((s,p)=>s+(Number(p.amount)||0),0)
    const history=(h.rentRegisterHistory||[]).filter(x=>activeInMonth(x,month)&&x.month==null).sort((a,b)=>Number(a.movedInAt||0)-Number(b.movedInAt||0)); const entry=history.at(-1); const occupied=(h.rentRegisterHistory||[]).length?!!entry:h.status==='occupied'; const tenant=entry?.name||(occupied?h.tenantName:'—'); const tenantPhone=entry?.phone||(occupied?h.tenantPhone:null); const expected=occupied?Number(entry?.rentAmount??h.rentAmount)||0:0
    return { ...h, id:h.id, door:h.internalDoorNumber||h.govtDoorNumber||h.id, tenant, tenantPhone, expected, collected:amount, status:statusFor({...h,status:occupied?'occupied':'vacant',rentAmount:expected},own), waiting, own }
  }).sort((a,b)=>String(a.door).localeCompare(String(b.door),undefined,{numeric:true})),[houses,payments,month])
  const filtered = useMemo(()=>rows.filter(r=>{
    const q=search.trim().toLowerCase()
    const match=!q||[r.door,r.govtDoorNumber,r.tenant,r.tenantPhone,r.id].some(v=>String(v||'').toLowerCase().includes(q))
    return match&&(filter==='All'||(filter==='Waiting'?(r.status==='Waiting'||r.waiting.length>0):r.status===filter))
  }),[rows,search,filter])
  const stats = useMemo(()=>rows.reduce((s,r)=>{ if(r.status!=='Vacant') s.expected+=r.expected; s.collected+=r.collected; if(r.status==='Paid')s.paid++; if(r.status==='Partial')s.partial++; if(r.waiting.length>0)s.waiting++; if(r.status==='Unpaid')s.unpaid++; return s },{expected:0,collected:0,paid:0,partial:0,waiting:0,unpaid:0}),[rows])

  if(view==='financial') return <div className="space-y-3"><button onClick={()=>setView('register')} className="text-sm font-semibold text-brand hover:underline">← Back to rent register</button><MonthlyFinancialReport /></div>
  return <div className="max-w-6xl mx-auto space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-bold text-ink">Rent collection register</h2><p className="text-sm text-ink-soft mt-1">See who paid, who is pending, and each payment’s details for any month.</p></div>
      <div className="flex flex-wrap gap-2 no-print">
        <button onClick={()=>setView('financial')} className="px-3 py-2 rounded-lg border border-brass/30 text-sm flex items-center gap-2"><FileText size={16}/> Full financial report</button>
        <button onClick={()=>window.print()} className="px-3 py-2 rounded-lg bg-cover text-white text-sm flex items-center gap-2"><Printer size={16}/> Print</button>
        <button onClick={()=>load({quiet:true})} disabled={loading||refreshing} aria-label="Refresh rent register" className="p-2 rounded-lg border border-brass/30 disabled:opacity-50"><RefreshCw size={17} className={refreshing?'animate-spin':''}/></button>
      </div>
    </div>
    <section className="flex items-center justify-between gap-3 rounded-xl border border-brass/20 bg-paper-raised p-3 no-print">
      <button onClick={()=>setMonth(m=>shiftMonth(m,-1))} aria-label="Previous month" className="p-2 rounded-lg hover:bg-paper"><ChevronLeft size={20}/></button>
      <div className="text-center"><div className="font-semibold">{monthLabel(month)}</div><input aria-label="Choose rent month" type="month" value={month} max={currentMonth()} onChange={e=>e.target.value&&setMonth(e.target.value)} className="mt-1 text-xs bg-transparent text-ink-soft text-center"/></div>
      <button onClick={()=>setMonth(m=>shiftMonth(m,1))} disabled={month>=currentMonth()} aria-label="Next month" className="p-2 rounded-lg hover:bg-paper disabled:opacity-30"><ChevronRight size={20}/></button>
    </section>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {[['Expected',money(stats.expected)],['Collected',money(stats.collected)],['Paid',stats.paid],['Waiting',stats.waiting],['Unpaid / partial',stats.unpaid+stats.partial]].map(([label,value])=><div key={label} className="rounded-xl border border-brass/20 bg-paper-raised p-3 sm:p-4"><div className="text-xs text-ink-soft">{label}</div><div className="mt-1 text-xl sm:text-2xl font-bold text-ink">{value}</div></div>)}
    </div>
    <div className="flex flex-col sm:flex-row gap-2 no-print">
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search door, tenant, phone or ID" className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-brass/25 bg-paper-raised text-sm"/></div>
      <select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter rent status" className="rounded-lg border border-brass/25 bg-paper-raised px-3 py-2.5 text-sm">{['All','Paid','Partial','Waiting','Unpaid','Vacant'].map(s=><option key={s}>{s}</option>)}</select>
    </div>
    {loading ? <div className="rounded-xl border border-brass/20 bg-paper-raised p-8 text-center text-sm text-ink-soft">Loading rent records…</div> : <div className="rounded-xl border border-brass/20 bg-paper-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-brass/15 flex justify-between items-center"><h3 className="font-semibold">House-wise status</h3><span className="text-xs text-ink-soft">{filtered.length} of {rows.length} houses</span></div>
      {filtered.length===0 ? <div className="p-8 text-center text-sm text-ink-soft">No houses match this search or filter.</div> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-paper text-xs uppercase text-ink-soft"><tr>{['Door / tenant','Rent due','Approved amount','Balance','Status','Payment details'].map(h=><th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-brass/10">{filtered.map(r=><tr key={r.id} className="align-top"><td className="px-4 py-3 min-w-[160px]"><div className="font-semibold">{r.door}</div><div className="text-ink-soft mt-0.5">{r.tenant}</div>{r.tenantPhone&&<div className="text-xs text-ink-soft">{r.tenantPhone}</div>}</td><td className="px-4 py-3 whitespace-nowrap">{r.status==='Vacant'?'—':money(r.expected)}</td><td className="px-4 py-3 whitespace-nowrap font-medium">{money(r.collected)}{r.waiting.length>0&&<div className="text-xs text-amber-700 mt-1">{r.waiting.length} awaiting review</div>}</td><td className="px-4 py-3 whitespace-nowrap">{r.status==='Vacant'?'—':money(Math.max(0,r.expected-r.collected))}</td><td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${r.status==='Paid'?'bg-green-100 text-green-800':r.status==='Partial'?'bg-amber-100 text-amber-800':r.status==='Waiting'?'bg-blue-100 text-blue-800':r.status==='Unpaid'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-600'}`}>{r.status}</span></td><td className="px-4 py-3 min-w-[260px] space-y-2">{r.own.length===0?<span className="text-xs text-ink-soft">No payment submitted</span>:r.own.map(p=><div key={p.id} className="text-xs border-l-2 border-brass/30 pl-2"><div className="font-semibold">{money(p.amount)} · {p.status==='approved'?'Approved':p.status==='waiting_approval'?'Waiting approval':p.status==='rejected'?'Rejected':p.status==='corrected'?'Corrected':p.status}</div><div className="text-ink-soft">{p.mode||'Method not recorded'} · {p.applicationNumber||p.id}{p.transactionId?` · Ref: ${p.transactionId}`:p.referenceNumber?` · Ref: ${p.referenceNumber}`:p.utr?` · UTR: ${p.utr}`:''}</div><div className="text-ink-soft">Submitted: {stamp(p.dateSent||p.submittedAt)}{p.approvedAt?` · Approved: ${stamp(p.approvedAt)}`:''}</div>{p.rejectionReason&&<div className="text-red-700">Reason: {p.rejectionReason}</div>}{p.cashReceivedBy&&<div className="text-ink-soft">Received by: {p.cashReceivedBy}</div>}{p.neighborCollectedBy&&<div className="text-ink-soft">Collected by: {p.neighborCollectedBy}</div>}{p.recordedBy?.name&&<div className="text-ink-soft">Recorded by: {p.recordedBy.name}</div>}{p.replacementAmount!=null&&<div className="text-ink-soft">Correction amount: {money(p.replacementAmount)}</div>}</div>)}</td></tr>)}</tbody></table></div>}
    </div>}
    <p className="text-xs text-ink-soft">“Paid” reflects approved rent entries. Waiting submissions are shown separately and are not counted as collected. Vacant houses are excluded from expected rent. This register is read-only; use Rent approvals or Manual payment to record changes.</p>
    <style>{`@media print {.no-print{display:none!important} body{background:white!important} main{padding:0!important} table{font-size:10px} th,td{padding:6px!important}}`}</style>
  </div>
}
