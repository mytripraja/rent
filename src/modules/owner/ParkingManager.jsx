import { useEffect, useMemo, useRef, useState } from 'react'
import { Bike, CarFront, Check, ChevronDown, MapPin, Plus, RotateCcw, UserRound, X, Zap } from 'lucide-react'
import { listSlots, createSlot, assignSlot, releaseSlot, updateSlotPosition } from '../../services/parkingService'
import { listHouses } from '../../services/houseService'

function slotPosition(slot, index) {
  if (Number.isFinite(Number(slot.x)) && Number.isFinite(Number(slot.y))) return { x: Number(slot.x), y: Number(slot.y) }
  const col = index % 5; const row = Math.floor(index / 5)
  return { x: 7 + col * 18, y: 8 + row * 24 }
}

export default function ParkingManager() {
  const [slots, setSlots] = useState([])
  const [houses, setHouses] = useState([])
  const [floor, setFloor] = useState('Ground')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [newSlot, setNewSlot] = useState({ type: 'four_wheeler', floor: 'Ground' })
  const [assignment, setAssignment] = useState({ houseId: '', tenantName: '', vehicleNumber: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dragRef = useRef(null)
  const didDragRef = useRef(false)

  async function load() {
    setError('')
    try { setSlots(await listSlots()); setHouses(await listHouses()) }
    catch (e) { console.error(e); setError(e?.message || 'Could not load parking.') }
  }
  useEffect(() => { load() }, [])

  const floors = useMemo(() => ['Ground', ...Array.from(new Set(slots.map(s => s.floor).filter(Boolean))).filter(x => x !== 'Ground')], [slots])
  const visible = slots.filter(s => (s.floor || 'Ground') === floor)

  async function addSlot() {
    setSaving(true); setError('')
    try {
      const sameFloor = slots.filter(s => (s.floor || 'Ground') === newSlot.floor)
      const index = sameFloor.length
      const col = index % 5; const row = Math.floor(index / 5)
      const slotNumber = `${newSlot.floor === 'Ground' ? 'G' : newSlot.floor[0]}-${String(index + 1).padStart(2, '0')}`
      await createSlot({ slotNumber, type: newSlot.type, floor: newSlot.floor, x: 7 + col * 18, y: 8 + row * 24 })
      setShowAdd(false); await load(); setFloor(newSlot.floor)
    } catch (e) { setError(e?.message || 'Could not add parking slot.') }
    finally { setSaving(false) }
  }

  function openAssign(slot) {
    setSelected(slot)
    setAssignment({ houseId: slot.assignedHouseId || '', tenantName: slot.assignedTenantName || '', vehicleNumber: slot.vehicleNumber || '' })
    setShowAssign(true)
  }
  async function saveAssignment() {
    if (!selected || !assignment.houseId || !assignment.tenantName) return
    setSaving(true); setError('')
    try { await assignSlot(selected.id, assignment); setShowAssign(false); setSelected(null); await load() }
    catch (e) { setError(e?.message || 'Could not assign parking.') }
    finally { setSaving(false) }
  }
  async function release() {
    if (!selected) return
    setSaving(true)
    try { await releaseSlot(selected.id); setShowAssign(false); setSelected(null); await load() }
    catch (e) { setError(e?.message || 'Could not release parking.') }
    finally { setSaving(false) }
  }
  function vehicleIcon(type) {
    if (type === 'two_wheeler') return Bike
    if (type === 'ev') return Zap
    return CarFront
  }

  function startDrag(e, slot) {
    if (e.button !== undefined && e.button !== 0) return
    const x = Number(slot.x ?? 8), y = Number(slot.y ?? 8)
    dragRef.current = { id: slot.id, startX: e.clientX, startY: e.clientY, x, y, lastX: x, lastY: y }
    didDragRef.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function moveDrag(e) {
    const drag = dragRef.current
    if (!drag) return
    const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
    if (distance < 4) return
    didDragRef.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = ((e.clientX - drag.startX) / rect.width) * 100
    const dy = ((e.clientY - drag.startY) / rect.height) * 100
    const nextX = Math.max(4, Math.min(96, drag.x + dx))
    const nextY = Math.max(6, Math.min(94, drag.y + dy))
    drag.lastX = nextX
    drag.lastY = nextY
    setSlots(prev => prev.map(s => s.id === drag.id ? { ...s, x: nextX, y: nextY } : s))
  }

  async function endDrag(e) {
    const drag = dragRef.current
    if (!drag) return
    const moved = didDragRef.current
    const slot = slots.find(s => s.id === drag.id)
    const finalX = drag.lastX ?? slot?.x
    const finalY = drag.lastY ?? slot?.y
    dragRef.current = null
    if (moved && slot) {
      try { await updateSlotPosition(slot.id, { x: Number(finalX), y: Number(finalY) }) }
      catch (err) { setError(err?.message || 'Could not save parking position.') }
    }
  }


  return <div className="space-y-4">
    <div className="rm-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><div className="rm-kicker">Parking</div><h2 className="font-display text-2xl font-extrabold mt-1">Visual parking map</h2><p className="text-sm text-ink-soft mt-1">Tap a slot like selecting a seat. Green means assigned; open slots can be allocated in one step.</p></div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/> Add slot</button>
      </div>
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex gap-2 overflow-x-auto pt-4 pb-1">{floors.map(f => <button key={f} onClick={() => setFloor(f)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${floor === f ? 'bg-brand text-white' : 'border border-[var(--rm-border)] text-ink-soft bg-paper'}`}>{f}</button>)}</div>
    </div>

    <section className="rm-card p-3 sm:p-5 overflow-hidden">
      <div className="relative min-h-[440px] sm:min-h-[500px] rounded-2xl border-2 border-[var(--rm-border-strong)] bg-paper overflow-hidden touch-none" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="absolute inset-0 opacity-45" style={{backgroundImage:'linear-gradient(var(--rm-border) 1px, transparent 1px),linear-gradient(90deg,var(--rm-border) 1px,transparent 1px)',backgroundSize:'5% 5%'}}/>
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-paper-raised/90 border border-[var(--rm-border)] px-3 py-1.5 text-xs font-semibold text-ink-soft"><MapPin size={13}/> Entry / driveway</div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[.3em] text-ink-soft/60 rotate-90">Drive lane</div>
        {visible.map((slot, index) => {
          const pos = slotPosition(slot, index)
          const assigned = slot.status === 'assigned'
          const VehicleIcon = vehicleIcon(slot.type)
          return <button key={slot.id} onPointerDown={e => startDrag(e, slot)} onClick={() => { if (!didDragRef.current) openAssign(slot) }} className={`absolute -translate-x-1/2 -translate-y-1/2 w-[15%] min-w-[74px] max-w-[118px] aspect-[1.45] rounded-xl border-2 p-2 text-left transition active:scale-95 ${assigned ? 'bg-brand/15 border-brand text-brand shadow-sm' : 'bg-paper-raised border-[var(--rm-border-strong)] text-ink hover:border-brand hover:shadow-md'}`} style={{left:`${pos.x}%`,top:`${pos.y}%`}}>
            <div className="flex items-center justify-between gap-1"><VehicleIcon size={16}/><span className="text-[10px] font-mono font-bold">{slot.slotNumber}</span></div>
            <p className="text-[9px] uppercase tracking-wide mt-1">{slot.type === 'two_wheeler' ? 'TWO WHEELER' : slot.type === 'four_wheeler' ? 'CAR' : 'EV'}</p>
            {assigned ? <p className="text-[10px] font-semibold mt-1 truncate">{slot.assignedTenantName}</p> : <p className="text-[10px] text-ink-soft mt-1">Available</p>}
          </button>
        })}
        {!visible.length && <div className="absolute inset-0 grid place-items-center text-center p-6"><div><CarFront className="mx-auto mb-2 text-ink-soft/50" size={32}/><p className="font-semibold text-ink">No slots on {floor}</p><p className="text-sm text-ink-soft mt-1">Add a slot and it will appear on the map.</p></div></div>}
      </div>
      <p className="text-xs text-ink-soft mt-3">Drag any vehicle slot to arrange the parking map. The position is saved automatically.</p><div className="flex flex-wrap gap-3 mt-3 text-xs text-ink-soft"><span className="inline-flex items-center gap-2"><i className="w-3 h-3 rounded bg-brand/20 border border-brand"/> Assigned</span><span className="inline-flex items-center gap-2"><i className="w-3 h-3 rounded bg-paper-raised border border-[var(--rm-border-strong)]"/> Available</span></div>
    </section>

    {showAdd && <div className="fixed inset-0 z-[80] bg-black/45 p-4 grid place-items-center" onMouseDown={e => e.currentTarget === e.target && setShowAdd(false)}><div className="w-full max-w-md rm-card p-5">
      <div className="flex items-center justify-between"><h3 className="font-display text-xl font-bold text-ink">Add parking slot</h3><button onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-paper"><X size={18}/></button></div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="text-sm font-semibold text-ink-soft">Floor<select value={newSlot.floor} onChange={e => setNewSlot(v => ({...v,floor:e.target.value}))} className="mt-1"><option>Ground</option>{Array.from({length:8},(_,i)=><option key={i}>Floor {i+1}</option>)}</select></label><label className="text-sm font-semibold text-ink-soft">Vehicle type<select value={newSlot.type} onChange={e => setNewSlot(v => ({...v,type:e.target.value}))} className="mt-1"><option value="four_wheeler">Car</option><option value="two_wheeler">Two-wheeler</option><option value="ev">EV</option></select></label></div>
      <button disabled={saving} onClick={addSlot} className="w-full mt-4 rounded-xl bg-brand text-white font-bold py-3 disabled:opacity-60">{saving ? 'Adding…' : 'Add to visual map'}</button>
    </div></div>}

    {showAssign && selected && <div className="fixed inset-0 z-[80] bg-black/45 p-4 grid place-items-center" onMouseDown={e => e.currentTarget === e.target && setShowAssign(false)}><div className="w-full max-w-md rm-card p-5">
      <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.14em] font-bold text-ink-soft">Parking {selected.slotNumber}</div><h3 className="font-display text-xl font-bold text-ink mt-1">{selected.status === 'assigned' ? 'Current assignment' : 'Assign this slot'}</h3></div><button onClick={() => setShowAssign(false)} className="p-2 rounded-lg hover:bg-paper"><X size={18}/></button></div>
      <label className="block text-sm font-semibold text-ink-soft mt-4">House<select value={assignment.houseId} onChange={e => { const h=houses.find(x=>x.id===e.target.value); setAssignment(v=>({...v,houseId:e.target.value,tenantName:h?.tenantName||''})) }} className="mt-1"><option value="">Select house</option>{houses.filter(h => h.status === 'occupied').map(h=><option key={h.id} value={h.id}>{h.internalDoorNumber || h.id} — {h.tenantName || 'Tenant'}</option>)}</select></label>
      <label className="block text-sm font-semibold text-ink-soft mt-3">Resident name<input value={assignment.tenantName} onChange={e => setAssignment(v=>({...v,tenantName:e.target.value}))} className="mt-1"/></label>
      <label className="block text-sm font-semibold text-ink-soft mt-3">Vehicle number<input value={assignment.vehicleNumber} onChange={e => setAssignment(v=>({...v,vehicleNumber:e.target.value.toUpperCase()}))} placeholder="TN 00 AB 0000" className="mt-1 uppercase"/></label>
      <div className="flex gap-2 mt-5"><button disabled={saving || !assignment.houseId || !assignment.tenantName} onClick={saveAssignment} className="flex-1 rounded-xl bg-brand text-white font-bold py-3 disabled:opacity-50"><Check size={16} className="inline mr-1"/> Save assignment</button>{selected.status === 'assigned' && <button disabled={saving} onClick={release} className="rounded-xl border border-stamp-red text-stamp-red font-bold px-4">Release</button>}</div>
    </div></div>}
  </div>
}
