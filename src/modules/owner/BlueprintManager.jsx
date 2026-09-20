import { useEffect, useMemo, useState } from 'react'
import { Building2, DoorOpen, Download, Eye, Grip, LampCeiling, Plus, Save, Shield, Milestone, Trash2, CarFront } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { listHouses, getHouse, setBlueprintVisibility } from '../../services/houseService'
import { getHouseBlueprint, saveHouseBlueprint, getPropertyBlueprint, savePropertyBlueprint } from '../../services/blueprintService'

const ROOM_TYPES = ['Room', 'Bedroom', 'Kitchen', 'Hall', 'Bathroom', 'Balcony', 'Office', 'Store', 'Dining', 'Apartment unit']
const FEATURE_TYPES = [
  ['Entry', DoorOpen], ['Stairs', Milestone], ['Lift', Building2], ['Parking', CarFront], ['Electrical', LampCeiling]
]
const COLORS = ['#d9f2ee', '#e7eef8', '#f8edd9', '#ece7f7', '#e9ecef']

function freshFloor(index = 0) { return { id: `floor-${Date.now()}-${index}`, name: index === 0 ? 'Ground floor' : `Floor ${index + 1}`, rooms: [], features: [] } }
function normalizeBlueprint(data) {
  return { floors: data?.floors?.length ? data.floors : [freshFloor()], visibleToTenants: Boolean(data?.visibleToTenants), updatedAt: data?.updatedAt || null, updatedBy: data?.updatedBy || null }
}

export default function BlueprintManager() {
  const { user } = useAuth()
  const owner = user?.role === 'admin' || user?.role === 'owner'
  const tenant = user?.role === 'tenant'
  const [houses, setHouses] = useState([])
  const [houseId, setHouseId] = useState(tenant ? user?.houseId : 'property')
  const [blueprint, setBlueprint] = useState(normalizeBlueprint(null))
  const [floorId, setFloorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [drag, setDrag] = useState(null)
  const [tenantVisible, setTenantVisible] = useState(false)
  const [resolvedScope, setResolvedScope] = useState(houseId)

  useEffect(() => { if (owner) listHouses().then(setHouses).catch(() => setError('Could not load houses.')) }, [owner])
  useEffect(() => { load() }, [houseId, user?.uid])

  async function load() {
    if (!houseId) return
    setLoading(true); setError(''); setSelected(null)
    try {
      if (tenant) {
        const house = await getHouse(houseId)
        const houseAllowed = !!house?.blueprintVisibleToTenants
        if (houseAllowed) {
          const data = await getHouseBlueprint(houseId)
          setResolvedScope(houseId)
          setTenantVisible(true)
          setBlueprint(normalizeBlueprint(data))
          setFloorId(data?.floors?.[0]?.id || 'ground')
        } else {
          let propertyData = null
          try { propertyData = await getPropertyBlueprint() } catch (propertyError) { console.warn('Shared property blueprint unavailable', propertyError) }
          const propertyAllowed = !!propertyData?.visibleToTenants
          setResolvedScope('property')
          setTenantVisible(propertyAllowed)
          setBlueprint(normalizeBlueprint(propertyData))
          setFloorId(propertyData?.floors?.[0]?.id || 'ground')
        }
        setLoading(false)
        return
      }
      const data = houseId === 'property' ? await getPropertyBlueprint() : await getHouseBlueprint(houseId)
      setResolvedScope(houseId)
      setBlueprint(normalizeBlueprint(data)); setTenantVisible(Boolean(data?.visibleToTenants)); setFloorId(data?.floors?.[0]?.id || 'ground')
    } catch (e) { console.error(e); setError(e?.message || 'Could not load blueprint.') }
    finally { setLoading(false) }
  }

  const floor = useMemo(() => blueprint.floors.find(f => f.id === floorId) || blueprint.floors[0], [blueprint, floorId])
  const selectedItem = floor?.rooms.find(r => r.id === selected) || floor?.features.find(f => f.id === selected)
  const selectedIsFeature = Boolean(selectedItem && floor?.features.some(f => f.id === selected))

  function updateFloor(next) { setBlueprint(b => ({ ...b, floors: b.floors.map(f => f.id === floor.id ? next : f) })) }
  function addFloor() { const next = freshFloor(blueprint.floors.length); setBlueprint(b => ({ ...b, floors: [...b.floors, next] })); setFloorId(next.id) }
  function removeFloor() { if (blueprint.floors.length === 1) return; const index = blueprint.floors.findIndex(f => f.id === floor.id); const next = blueprint.floors.filter(f => f.id !== floor.id); setBlueprint(b => ({ ...b, floors: next })); setFloorId(next[Math.max(0, index - 1)].id); setSelected(null) }
  function addRoom(type = 'Room') {
    const room = { id: `room-${Date.now()}`, name: type, type, x: 8, y: 8, w: 28, h: 22, color: COLORS[(floor.rooms.length) % COLORS.length] }
    updateFloor({ ...floor, rooms: [...floor.rooms, room] }); setSelected(room.id)
  }
  function addFeature(type) {
    const item = { id: `feature-${Date.now()}`, name: type, type, x: 60, y: 10 + ((floor.features.length * 16) % 70), w: 18, h: 12 }
    updateFloor({ ...floor, features: [...floor.features, item] }); setSelected(item.id)
  }
  function patchSelected(patch) {
    if (!selectedItem) return
    const collection = selectedIsFeature ? 'features' : 'rooms'
    updateFloor({ ...floor, [collection]: floor[collection].map(i => i.id === selected ? { ...i, ...patch } : i) })
  }
  function removeSelected() {
    if (!selectedItem) return
    const collection = selectedIsFeature ? 'features' : 'rooms'
    updateFloor({ ...floor, [collection]: floor[collection].filter(i => i.id !== selected) }); setSelected(null)
  }
  function pointerMove(e) {
    if (!drag || !floor) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = ((e.clientX - drag.startX) / rect.width) * 100
    const dy = ((e.clientY - drag.startY) / rect.height) * 100
    patchSelected({ x: Math.max(0, Math.min(100 - drag.w, drag.x + dx)), y: Math.max(0, Math.min(100 - drag.h, drag.y + dy)) })
  }
  function startDrag(e, item) { e.currentTarget.setPointerCapture?.(e.pointerId); setSelected(item.id); setDrag({ startX: e.clientX, startY: e.clientY, x: item.x, y: item.y, w: item.w, h: item.h }) }
  function endDrag() { setDrag(null) }
  async function save() {
    if (!houseId) return
    setSaving(true); setError('')
    try {
      if (houseId === 'property') await savePropertyBlueprint(blueprint, user?.uid)
      else { await saveHouseBlueprint(houseId, blueprint, user?.uid); await setBlueprintVisibility(houseId, blueprint.visibleToTenants) }
    } catch (e) { console.error(e); setError(e?.message || 'Could not save blueprint.') }
    finally { setSaving(false) }
  }
  function printBlueprint() { window.print() }

  if (loading) return <div className="rm-card p-6 text-sm text-ink-soft">Loading blueprint…</div>
  if (tenant && !tenantVisible) return <div className="rm-card p-8 text-center"><Shield className="mx-auto text-ink-soft mb-3"/><h2 className="font-display text-xl font-bold text-ink">Blueprint not shared</h2><p className="text-sm text-ink-soft mt-1">The property owner has not made a blueprint visible to residents.</p></div>

  return <div className="space-y-4 print-area">
    <div className="rm-card p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div><div className="rm-kicker">Floor plans</div><h2 className="font-display text-2xl font-extrabold mt-1">{resolvedScope === 'property' ? 'Property blueprint' : 'House blueprint'}</h2><p className="text-sm text-ink-soft mt-1">Build a simple visual plan with rooms, entry, stairs, lift and parking positions.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={printBlueprint} className="rm-secondary-button"><Download size={16}/> Print / PDF</button>
          {owner && <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save size={16}/>{saving ? 'Saving…' : 'Save blueprint'}</button>}
        </div>
      </div>
      {owner && <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-4">
        <select value={houseId} onChange={e => setHouseId(e.target.value)} className="w-full"><option value="property">Whole apartment / property</option>{houses.map(h => <option key={h.id} value={h.id}>{h.internalDoorNumber || h.doorNumber || h.id} — {h.tenantName || 'Vacant'}</option>)}</select>
        <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--rm-border)] px-3 py-2 text-sm font-semibold text-ink"><input type="checkbox" checked={blueprint.visibleToTenants} onChange={e => setBlueprint(b => ({ ...b, visibleToTenants: e.target.checked }))}/> Residents can view</label>
      </div>}
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_250px] gap-4">

      <aside className="rm-card p-3 space-y-3 order-2 lg:order-1">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.14em] text-ink-soft">Floors</p>{owner && <button onClick={addFloor} className="p-1.5 rounded-lg bg-brand/10 text-brand" title="Add floor"><Plus size={15}/></button>}</div>
        <div className="space-y-1">{blueprint.floors.map((f, i) => <button key={f.id} onClick={() => { setFloorId(f.id); setSelected(null) }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${f.id === floor.id ? 'bg-brand/10 text-brand font-bold' : 'text-ink-soft hover:bg-paper'}`}>{f.name || `Floor ${i + 1}`}</button>)}</div>
        {owner && blueprint.floors.length > 1 && <button onClick={removeFloor} className="text-xs text-stamp-red font-semibold">Remove current floor</button>}
        {owner && <div className="pt-3 border-t border-[var(--rm-border)] space-y-2"><p className="text-xs font-bold uppercase tracking-[.14em] text-ink-soft">Add</p><div className="grid grid-cols-2 gap-1.5">{ROOM_TYPES.slice(0,6).map(type => <button key={type} onClick={() => addRoom(type)} className="rounded-lg border border-[var(--rm-border)] px-2 py-2 text-xs text-ink hover:border-brand/30">{type}</button>)}</div><div className="grid grid-cols-2 gap-1.5">{FEATURE_TYPES.map(([type]) => <button key={type} onClick={() => addFeature(type)} className="rounded-lg border border-[var(--rm-border)] px-2 py-2 text-xs text-ink hover:border-brand/30">{type}</button>)}</div></div>}
      </aside>

      <section className="rm-card p-3 sm:p-5 overflow-hidden order-1 lg:order-2">
        <div className="flex items-center justify-between mb-3"><input disabled={!owner} value={floor?.name || ''} onChange={e => updateFloor({ ...floor, name: e.target.value })} className="!min-h-0 !py-2 !px-3 font-bold"/><span className="text-xs text-ink-soft">Drag blocks to position them</span></div>
        <div className="relative aspect-[4/3] min-h-[280px] sm:min-h-[360px] max-h-[680px] rounded-2xl border-2 border-[var(--rm-border-strong)] bg-paper overflow-hidden touch-none" onPointerMove={pointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <div className="absolute inset-0 opacity-50" style={{backgroundImage:'linear-gradient(var(--rm-border) 1px, transparent 1px),linear-gradient(90deg,var(--rm-border) 1px,transparent 1px)',backgroundSize:'5% 5%'}}/>
          {floor?.rooms.map(item => <div key={item.id} tabIndex={owner ? 0 : -1} role="button" aria-label={`${item.name} room. Use arrow keys to move.`} onPointerDown={e => owner && startDrag(e,item)} onClick={() => setSelected(item.id)} onKeyDown={e => { if (!owner) return; const step=e.shiftKey?5:1; if(e.key==='ArrowLeft'){e.preventDefault();patchSelected({x:Math.max(0,item.x-step)})} if(e.key==='ArrowRight'){e.preventDefault();patchSelected({x:Math.min(100-item.w,item.x+step)})} if(e.key==='ArrowUp'){e.preventDefault();patchSelected({y:Math.max(0,item.y-step)})} if(e.key==='ArrowDown'){e.preventDefault();patchSelected({y:Math.min(100-item.h,item.y+step)})} }} className={`absolute rounded-lg border-2 p-2 cursor-grab select-none overflow-hidden ${selected === item.id ? 'border-brand ring-2 ring-brand/20' : 'border-slate-400'}`} style={{left:`${item.x}%`,top:`${item.y}%`,width:`${item.w}%`,height:`${item.h}%`,background:item.color}}><div className="flex items-start gap-1 text-xs font-bold text-slate-700"><Grip size={13}/><span className="truncate">{item.name}</span></div><span className="text-[10px] text-slate-600">{item.type}</span></div>)}
          {floor?.features.map(item => <div key={item.id} tabIndex={owner ? 0 : -1} role="button" aria-label={`${item.name} feature. Use arrow keys to move.`} onPointerDown={e => owner && startDrag(e,item)} onClick={() => setSelected(item.id)} className={`absolute rounded-lg border-2 border-dashed p-2 cursor-grab select-none overflow-hidden bg-paper-raised/90 ${selected === item.id ? 'border-brand ring-2 ring-brand/20' : 'border-brand/60'}`} style={{left:`${item.x}%`,top:`${item.y}%`,width:`${item.w}%`,height:`${item.h}%`}}><div className="text-xs font-bold text-brand">{item.type}</div><div className="text-[10px] text-ink-soft">Common feature</div></div>)}
          {(!floor?.rooms.length && !floor?.features.length) && <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft"><div className="text-center"><Building2 className="mx-auto mb-2 opacity-40"/><p>Add rooms or features from the left.</p></div></div>}
        </div>
      </section>

      <aside className="rm-card p-4 order-3 lg:order-3">
        {selectedItem ? <>
          <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.14em] font-bold text-ink-soft">Selected</p><h3 className="font-display text-lg font-bold text-ink mt-1">{selectedItem.name}</h3></div>{owner && <button onClick={removeSelected} className="p-2 rounded-lg text-stamp-red hover:bg-red-50"><Trash2 size={16}/></button>}</div>
          {owner && <div className="space-y-3 mt-4">
            <label className="block text-xs font-semibold text-ink-soft">Name<input value={selectedItem.name} onChange={e => patchSelected({name:e.target.value})} className="mt-1"/></label>
            {!selectedIsFeature && <label className="block text-xs font-semibold text-ink-soft">Room type<select value={selectedItem.type} onChange={e => patchSelected({type:e.target.value})} className="mt-1">{ROOM_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>}
            {!selectedIsFeature && <label className="block text-xs font-semibold text-ink-soft">Room color<select value={selectedItem.color} onChange={e => patchSelected({color:e.target.value})} className="mt-1">{COLORS.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
            <div className="grid grid-cols-2 gap-2">{['x','y','w','h'].map(k => <label key={k} className="text-xs font-semibold text-ink-soft uppercase">{k}<input type="number" min="1" max="100" value={Math.round(selectedItem[k])} onChange={e => patchSelected({[k]:Number(e.target.value)})} className="mt-1"/></label>)}</div>
          </div>}
        </> : <div className="text-sm text-ink-soft"><Eye size={18} className="mb-2"/><p>Select a room or feature to edit it.</p></div>}
        <div className="mt-5 pt-4 border-t border-[var(--rm-border)] text-xs text-ink-soft"><p className="font-semibold text-ink">Visibility</p><p className="mt-1">{blueprint.visibleToTenants ? 'Residents can view this plan.' : 'Owner/admin only.'}</p></div>
      </aside>
    </div>
  </div>
}
