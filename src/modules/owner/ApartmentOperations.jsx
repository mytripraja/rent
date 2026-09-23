import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Building2, Camera, CheckCircle2, Droplets, Gauge, History, Plus, Save, ShieldCheck, Trash2, Video, Wrench, X, Zap } from 'lucide-react'
import { getProperties, addProperty, getActivePropertyId, setActivePropertyId } from '../../services/configService'
import { listAllHouses, listHouses, setHouseProperty } from '../../services/houseService'
import { uploadPrivate, getPrivateViewUrl } from '../../services/cloudinaryService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'
import { cachedRequest, invalidateCache } from '../../services/performanceCache'
import { getApartmentOperations, saveApartmentOperations, recordMotorCommand, listApartmentIssues, saveApartmentIssue, deleteApartmentIssue, listCctvCameras, saveCctvCamera, deleteCctvCamera, listCctvFootageRequests, saveCctvFootageRequest, warrantyStatus } from '../../services/apartmentOperationsService'

const emptyMotor = { name:'', type:'bore', status:'off', targetReading:15, targetUnit:'kW', tolerance:0, retryMin:5, retryMax:10, notes:'' }
const emptyTank = { name:'', type:'sump', capacityLitres:0, fillMinutesBore:25, fillMinutesSump:10, lastCleanedDate:'', cleaningIntervalMonths:18, notes:'' }
const emptyIssue = { title:'', houseId:'', category:'Water', severity:'medium', occurredAt:new Date().toISOString().slice(0,16), durationMinutes:60, recurrence:'one-time', status:'open', rootCause:'', actionTaken:'', followUpDate:'', notes:'', futureFlag:true }
const emptyCamera = { name:'', houseId:'', location:'', direction:'', mainBoxLocation:'', loginUsername:'', credentialVaultRef:'', purchaseDate:'', warrantyMonths:12, notes:'' }
const emptyFootage = { cameraId:'', requesterName:'', requesterContact:'', footageDate:'', fromTime:'', toTime:'', purpose:'', recordCopied:false, copyFileUrl:'', copyPublicId:'', notes:'' }

function Panel({ title, icon:Icon, children, action }) { return <section className="rm-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center"><Icon size={19}/></span><div><h3 className="font-display text-lg font-bold text-ink">{title}</h3></div></div>{action}</div>{children}</section> }

export default function ApartmentOperations({ initialCreate = false }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const owner = user?.role === 'owner' || user?.role === 'admin'
  const [properties, setProperties] = useState([])
  const [activeId, setActiveId] = useState('')
  const [newProperty, setNewProperty] = useState({ name:'', address:'' })
  const [showCreate, setShowCreate] = useState(initialCreate)
  const [showAssignments, setShowAssignments] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [houses, setHouses] = useState([])
  const [allHouses, setAllHouses] = useState([])
  const [ops, setOps] = useState(null)
  const [issues, setIssues] = useState([])
  const [cameras, setCameras] = useState([])
  const [footage, setFootage] = useState([])
  const [motor, setMotor] = useState(emptyMotor)
  const [tank, setTank] = useState(emptyTank)
  const [issue, setIssue] = useState(emptyIssue)
  const [camera, setCamera] = useState(emptyCamera)
  const [request, setRequest] = useState(emptyFootage)
  const [footageFile, setFootageFile] = useState(null)
  const [tab, setTab] = useState('water')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const active = properties.find(p => p.id === activeId)
  const currentMotors = ops?.motors || []
  const currentTanks = ops?.tanks || []
  const settings = ops?.settings || { targetReading:15, targetUnit:'kW', tolerance:0, retryMin:5, retryMax:10 }

  async function loadProperties() {
    const all = await getProperties()
    const list = user?.role === 'admin' || !Array.isArray(user?.propertyAccess) || user.propertyAccess.includes('*') ? all : all.filter(p => user.propertyAccess.includes(p.id))
    setProperties(list)
    const saved = getActivePropertyId(); const id = saved && list.some(p=>p.id===saved) ? saved : list[0]?.id || ''
    setActiveId(id); if (id) setActivePropertyId(id)
  }

  async function loadData(id) {
    if (!id) return
    setError(''); setLoading(true)
    try {
      const [o,h] = await Promise.all([
        cachedRequest(`apartment-ops:${id}`, () => getApartmentOperations(id), 10000),
        cachedRequest(`houses:${id}`, () => listHouses(id), 10000),
      ])
      setOps(o); setHouses(h)
      if (tab === 'problems') setIssues(await listApartmentIssues(id))
      if (tab === 'cctv') {
        const [c,f] = await Promise.all([listCctvCameras(id), listCctvFootageRequests(id)])
        setCameras(c); setFootage(f)
      }
    } catch (e) { setError(e?.message || 'Could not load apartment operations.') } finally { setLoading(false) }
  }

  async function loadAssignments() {
    if (!activeId || loadingAssignments) return
    setLoadingAssignments(true)
    try {
      const allRaw = await cachedRequest('houses:all', () => listAllHouses(), 10000)
      const all = allRaw.filter(x => !Array.isArray(user?.propertyAccess) || user?.role === 'admin' || user.propertyAccess.includes('*') || user.propertyAccess.includes(x.propertyId || 'default'))
      setAllHouses(all)
    } catch (e) { setError(e?.message || 'Could not load house assignments.') } finally { setLoadingAssignments(false) }
  }

  useEffect(() => { loadProperties().catch(e=>setError(e.message)) }, [user?.uid, JSON.stringify(user?.propertyAccess)])
  useEffect(() => { loadData(activeId) }, [activeId, tab])
  useEffect(() => { if (showAssignments) loadAssignments() }, [showAssignments, activeId])

  async function createApartment() {
    if (!newProperty.name.trim()) return
    setSaving(true)
    try {
      const id = `property-${Date.now()}`
      await addProperty({ id, name:newProperty.name.trim(), address:newProperty.address.trim() })
      const created = { id, name:newProperty.name.trim(), address:newProperty.address.trim(), createdAt:Date.now() }
      setProperties(prev => [...prev, created]); invalidateCache('properties:')
      setNewProperty({name:'',address:''})
      setActivePropertyId(id); setActiveId(id); setShowCreate(false)
      window.dispatchEvent(new CustomEvent('rm:property-created', { detail: created }))
      window.dispatchEvent(new CustomEvent('rm:property-changed', { detail: { id } }))
      showToast({message:`${created.name} created successfully`,type:'success'})
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  async function saveMotors() {
    setSaving(true)
    try { await saveApartmentOperations(activeId, { motors: currentMotors, tanks: currentTanks, settings }); invalidateCache(`apartment-ops:${activeId}`); await loadData(activeId); showToast({message:'Motor settings saved',type:'success'}) }
    catch(e){setError(e.message)} finally{setSaving(false)}
  }

  async function addMotor() {
    if (!motor.name.trim()) return
    const next = [...currentMotors, { ...motor, id:`motor-${Date.now()}` }]
    setOps(v=>({...v,motors:next})); setMotor(emptyMotor)
  }
  async function addTank() {
    if (!tank.name.trim()) return
    const next = [...currentTanks, { ...tank, id:`tank-${Date.now()}` }]
    setOps(v=>({...v,tanks:next})); setTank(emptyTank)
  }
  async function motorCommand(m, command) {
    try {
      const reading = Number(prompt(`Enter current ${m.targetUnit || 'reading'} for ${m.name}`, String(m.targetReading ?? 15)))
      if (!Number.isFinite(reading)) return
      const target = Number(m.targetReading ?? settings.targetReading ?? 15)
      const tolerance = Number(m.tolerance ?? settings.tolerance ?? 0)
      const inRange = reading >= target - tolerance && reading <= target + tolerance
      if (command === 'start' && !inRange) {
        const retryMin = Number(m.retryMin || settings.retryMin || 5)
        const retryMax = Number(m.retryMax || settings.retryMax || 10)
        await recordMotorCommand(activeId, m.id, 'start-blocked', { reading, target, tolerance, retryAt:Date.now()+retryMin*60000, retryWindowMinutes:`${retryMin}-${retryMax}`, createdBy:user?.uid })
        showToast({message:`${m.name}: reading ${reading} is outside the target ${target}. Start blocked; retry in ${retryMin}-${retryMax} minutes.`,type:'error'})
        return
      }
      let nextMotors = (ops.motors || []).map(x => x.id === m.id ? { ...x, status: command === 'start' ? 'on' : 'off', lastReading: reading, lastCommandAt: Date.now() } : x)
      if (command === 'start' && m.type === 'sump') {
        const bore = nextMotors.find(x => x.type === 'bore' && x.status === 'on')
        if (bore) {
          await recordMotorCommand(activeId, bore.id, 'interlock-stop', { reason:'Sump motor started; bore motor must be off', createdBy:user?.uid })
          nextMotors = nextMotors.map(x => x.id === bore.id ? { ...x, status:'off', lastCommandAt:Date.now() } : x)
        }
      }
      await recordMotorCommand(activeId, m.id, command, { reading, target, tolerance, createdBy:user?.uid })
      setOps(v=>({...v,motors:nextMotors}))
      await saveApartmentOperations(activeId, { motors:nextMotors })
      showToast({message:`${m.name}: ${command === 'start' ? 'start command recorded' : 'stop command recorded'}`,type:'success'})
    } catch(e) { setError(e.message) }
  }

  async function saveIssue(e) { e?.preventDefault(); try { setSaving(true); await saveApartmentIssue(activeId, issue); setIssue(emptyIssue); setIssues(await listApartmentIssues(activeId)); showToast({message:'Problem history saved',type:'success'}) } catch(e){setError(e.message)} finally{setSaving(false)} }
  async function saveCamera(e) { e?.preventDefault(); try { setSaving(true); await saveCctvCamera(activeId,camera); setCamera(emptyCamera); setCameras(await listCctvCameras(activeId)); showToast({message:'Camera saved',type:'success'}) } catch(e){setError(e.message)} finally{setSaving(false)} }
  async function saveRequest(e) { e?.preventDefault(); try { setSaving(true); let fileMeta = {}; if (footageFile) { const uploaded = await uploadPrivate(footageFile, 'cctv-footage'); fileMeta = { copyPublicId: uploaded.publicId, copyResourceType: uploaded.resourceType, copyFileName: footageFile.name }; } await saveCctvFootageRequest(activeId,{...request,...fileMeta,recordCopied:request.recordCopied || !!footageFile}); setRequest(emptyFootage); setFootageFile(null); setFootage(await listCctvFootageRequests(activeId)); showToast({message:'Footage request saved',type:'success'}) } catch(e){setError(e.message)} finally{setSaving(false)} }

  const problemByHouse = useMemo(() => houses.map(h=>({ ...h, count:issues.filter(i=>i.houseId===h.id).length })),[houses,issues])

  if (!owner) return <div className="rm-card p-6"><ShieldCheck className="text-brand"/><h2 className="font-display text-xl font-bold mt-2">Apartment Operations</h2><p className="text-sm text-ink-soft mt-1">Owner access only.</p></div>

  if (loading) return <div className="space-y-4"><div className="rm-card p-5 animate-pulse"><div className="h-5 w-48 rounded bg-paper-raised"/><div className="h-3 w-80 max-w-full rounded bg-paper-raised mt-3"/><div className="h-11 w-full rounded-xl bg-paper-raised mt-5"/></div><div className="rm-card p-5"><div className="h-4 w-40 rounded bg-paper-raised"/><div className="h-24 rounded-2xl bg-paper-raised mt-4"/></div></div>

  return <div className="space-y-5">
    <div className="rm-card p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><div className="rm-kicker">Multi-apartment control</div><h2 className="font-display text-2xl sm:text-3xl font-extrabold mt-1">Apartment Operations</h2><p className="text-sm text-ink-soft mt-1 max-w-3xl">Every apartment has its own motors, tanks, cameras, warranty records and problem history. Switching apartments never merges their operational records.</p></div>
        <div className="flex flex-col sm:flex-row gap-2"><select aria-label="Change apartment" value={activeId} onChange={e=>{setActiveId(e.target.value);setActivePropertyId(e.target.value)}} className="min-w-56"><option value="">Select apartment</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button type="button" onClick={()=>setShowCreate(v=>!v)} className="rounded-xl border border-brand/30 text-brand px-4 py-2.5 font-bold"><Plus size={16} className="inline mr-1"/>{showCreate?'Close':'New apartment'}</button></div>
      </div>
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {showCreate && <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4"><p className="text-sm font-bold text-ink">Create a separate apartment</p><p className="text-xs text-ink-soft mt-1">This creates a separate operational workspace. Nothing is merged with the current apartment.</p><div className="mt-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2"><input aria-label="New apartment name" placeholder="Apartment name" value={newProperty.name} onChange={e=>setNewProperty(v=>({...v,name:e.target.value}))}/><input aria-label="Apartment address" placeholder="Address" value={newProperty.address} onChange={e=>setNewProperty(v=>({...v,address:e.target.value}))}/><button onClick={createApartment} disabled={saving||!newProperty.name.trim()} className="rounded-xl bg-brand text-white px-4 py-2.5 font-bold">Create</button></div></div>}
      {active && <div className="mt-3 rounded-xl bg-paper-raised border border-[var(--rm-border)] p-3 text-sm"><span className="text-ink-soft">Currently managing:</span> <b className="text-ink">{active.name}</b>{active.address ? <span className="text-ink-soft"> · {active.address}</span> : null}</div>}
      <div className="mt-4 border-t border-[var(--rm-border)] pt-4"><button type="button" onClick={()=>setShowAssignments(v=>!v)} className="w-full flex items-center justify-between gap-2 text-left"><div><p className="font-bold text-ink text-sm">Assign existing houses to an apartment</p><p className="text-xs text-ink-soft">Use this only when moving older houses between apartments.</p></div><Building2 size={18} className="text-brand"/></button>{showAssignments && <div className="mt-3 grid gap-2">{loadingAssignments && <div className="rounded-xl bg-paper-raised p-3 text-sm text-ink-soft">Loading house assignments…</div>}{allHouses.map(h=><div key={h.id} className="grid sm:grid-cols-[1fr_180px] gap-2 items-center rounded-xl border border-[var(--rm-border)] p-3"><div><p className="font-semibold text-ink">{h.internalDoorNumber}</p><p className="text-xs text-ink-soft">Current apartment: {properties.find(p=>p.id===(h.propertyId||'default'))?.name || (h.propertyId||'default')}</p></div><select value={h.propertyId||'default'} onChange={async e=>{try{await setHouseProperty(h.id,e.target.value);setAllHouses(prev=>prev.map(x=>x.id===h.id?{...x,propertyId:e.target.value}:x));setHouses(await listHouses(activeId))}catch(err){setError(err.message)}}}>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>)}{!loadingAssignments&&allHouses.length===0&&<p className="text-sm text-ink-soft">No houses created yet.</p>}</div>}</div>
    </div>

    <div className="flex gap-2 overflow-x-auto pb-1"><button onClick={()=>setTab('water')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab==='water'?'bg-brand text-white':'border border-[var(--rm-border)]'}`}>Water & Motors</button><button onClick={()=>setTab('problems')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab==='problems'?'bg-brand text-white':'border border-[var(--rm-border)]'}`}>Problem History</button><button onClick={()=>setTab('cctv')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab==='cctv'?'bg-brand text-white':'border border-[var(--rm-border)]'}`}>CCTV & Warranty</button></div>

    {tab==='water' && <div className="space-y-5">
      <Panel title="Motor safety & power target" icon={Gauge} action={<button onClick={saveMotors} disabled={saving} className="rounded-xl bg-brand text-white px-4 py-2 text-sm font-bold"><Save size={15} className="inline mr-1"/>Save</button>}>
        <div className="grid sm:grid-cols-4 gap-3"><label className="text-xs font-semibold text-ink-soft">Default target<input type="number" value={settings.targetReading ?? 15} onChange={e=>setOps(v=>({...v,settings:{...settings,targetReading:Number(e.target.value)}}))}/></label><label className="text-xs font-semibold text-ink-soft">Unit<select value={settings.targetUnit || 'kW'} onChange={e=>setOps(v=>({...v,settings:{...settings,targetUnit:e.target.value}}))}><option>kW</option><option>V</option><option>HP</option><option>A</option></select></label><label className="text-xs font-semibold text-ink-soft">Tolerance<input type="number" value={settings.tolerance ?? 0} onChange={e=>setOps(v=>({...v,settings:{...settings,tolerance:Number(e.target.value)}}))}/></label><label className="text-xs font-semibold text-ink-soft">Retry window (min)<div className="grid grid-cols-2 gap-1"><input type="number" min="5" max="10" value={settings.retryMin ?? 5} onChange={e=>setOps(v=>({...v,settings:{...settings,retryMin:Number(e.target.value)}}))}/><input type="number" min="5" max="10" value={settings.retryMax ?? 10} onChange={e=>setOps(v=>({...v,settings:{...settings,retryMax:Number(e.target.value)}}))}/></div></label></div>
        <div className="mt-3 rounded-xl bg-paper p-3 text-sm text-ink-soft">Start is treated as safe only when the measured reading is within the configured target. If it is outside the range, the start command is blocked and a retry is recorded for the configured 5–10 minute window. This screen records control commands; physical switching requires a connected relay/IoT controller.</div>
      </Panel>
      <Panel title="Motors" icon={Zap} action={<span className="text-xs text-ink-soft">Separate per apartment</span>}>
        <div className="grid sm:grid-cols-2 gap-3">{currentMotors.map(m=><div key={m.id} className="rounded-2xl border border-[var(--rm-border)] p-4"><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-ink">{m.name}</p><p className="text-xs text-ink-soft">{m.type==='bore'?'Bore motor':'Sump motor'} · target {m.targetReading ?? settings.targetReading} {m.targetUnit || settings.targetUnit}</p></div><span className={`text-xs font-bold rounded-full px-2 py-1 ${m.status==='on'?'bg-green-100 text-green-700':'bg-paper text-ink-soft'}`}>{m.status || 'off'}</span></div><p className="text-xs text-ink-soft mt-2">Last reading: {m.lastReading ?? '—'}</p><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>motorCommand(m,'start')} className="rounded-xl bg-brand text-white py-2.5 font-bold">Start / manage power</button><button onClick={()=>motorCommand(m,'stop')} className="rounded-xl border border-red-300 text-red-700 py-2.5 font-bold">Stop</button></div></div>)}{currentMotors.length===0&&<p className="text-sm text-ink-soft">No motors configured for this apartment yet.</p>}</div>
        <div className="mt-4 grid sm:grid-cols-4 gap-2"><input placeholder="Motor name (e.g. Bore Motor)" value={motor.name} onChange={e=>setMotor(v=>({...v,name:e.target.value}))}/><select value={motor.type} onChange={e=>setMotor(v=>({...v,type:e.target.value}))}><option value="bore">Bore motor</option><option value="sump">Sump motor</option><option value="other">Other</option></select><input type="number" value={motor.targetReading} onChange={e=>setMotor(v=>({...v,targetReading:Number(e.target.value)}))} placeholder="Target"/><button onClick={addMotor} className="rounded-xl bg-brand text-white font-bold"><Plus size={15} className="inline mr-1"/>Add motor</button></div>
      </Panel>
      <Panel title="Water tanks" icon={Droplets} action={<span className="text-xs text-ink-soft">Capacity + fill time</span>}>
        <div className="grid sm:grid-cols-2 gap-3">{currentTanks.map(t=><div key={t.id} className="rounded-2xl border border-[var(--rm-border)] p-4"><p className="font-bold text-ink">{t.name}</p><p className="text-xs text-ink-soft">{t.type} · {Number(t.capacityLitres||0).toLocaleString()} litres</p><div className="grid grid-cols-2 gap-2 mt-3 text-sm"><div className="bg-paper rounded-xl p-3">Bore fill<strong className="block text-ink">{t.fillMinutesBore || '—'} min</strong></div><div className="bg-paper rounded-xl p-3">Sump fill<strong className="block text-ink">{t.fillMinutesSump || '—'} min</strong></div></div><p className="text-xs text-ink-soft mt-2">Last cleaned: {t.lastCleanedDate || 'Not recorded'} · interval: {t.cleaningIntervalMonths || 18} months</p></div>)}{currentTanks.length===0&&<p className="text-sm text-ink-soft">No tanks configured yet.</p>}</div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-8 gap-2"><input placeholder="Tank name" value={tank.name} onChange={e=>setTank(v=>({...v,name:e.target.value}))}/><select value={tank.type} onChange={e=>setTank(v=>({...v,type:e.target.value}))}><option value="sump">Sump tank</option><option value="top">Top / concrete tank</option><option value="overhead">Overhead tank</option></select><input type="number" placeholder="Litres" value={tank.capacityLitres} onChange={e=>setTank(v=>({...v,capacityLitres:Number(e.target.value)}))}/><input type="number" placeholder="Bore min" value={tank.fillMinutesBore} onChange={e=>setTank(v=>({...v,fillMinutesBore:Number(e.target.value)}))}/><input type="number" placeholder="Sump min" value={tank.fillMinutesSump} onChange={e=>setTank(v=>({...v,fillMinutesSump:Number(e.target.value)}))}/><input type="date" title="Last cleaned" value={tank.lastCleanedDate} onChange={e=>setTank(v=>({...v,lastCleanedDate:e.target.value}))}/><input type="number" min="1" placeholder="Clean every months" value={tank.cleaningIntervalMonths} onChange={e=>setTank(v=>({...v,cleaningIntervalMonths:Number(e.target.value)}))}/><button onClick={addTank} className="rounded-xl bg-brand text-white font-bold"><Plus size={15} className="inline mr-1"/>Add</button></div>
      </Panel>
    </div>}

    {tab==='problems' && <div className="space-y-5"><Panel title="Record a recurring problem" icon={History}><form onSubmit={saveIssue} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-xs font-semibold text-ink-soft">House<select value={issue.houseId} onChange={e=>setIssue(v=>({...v,houseId:e.target.value}))}><option value="">Apartment-wide</option>{houses.map(h=><option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName||'Vacant'}</option>)}</select></label><label className="text-xs font-semibold text-ink-soft">Problem<input required value={issue.title} onChange={e=>setIssue(v=>({...v,title:e.target.value}))} placeholder="Water pressure drops"/></label><label className="text-xs font-semibold text-ink-soft">Category<select value={issue.category} onChange={e=>setIssue(v=>({...v,category:e.target.value}))}><option>Water</option><option>Motor</option><option>Electrical</option><option>Plumbing</option><option>CCTV</option><option>Structural</option><option>Other</option></select></label><label className="text-xs font-semibold text-ink-soft">Severity<select value={issue.severity} onChange={e=>setIssue(v=>({...v,severity:e.target.value}))}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label className="text-xs font-semibold text-ink-soft">Occurred<input type="datetime-local" value={issue.occurredAt} onChange={e=>setIssue(v=>({...v,occurredAt:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">Duration (minutes)<input type="number" value={issue.durationMinutes} onChange={e=>setIssue(v=>({...v,durationMinutes:Number(e.target.value)}))}/></label><label className="text-xs font-semibold text-ink-soft">Recurrence<select value={issue.recurrence} onChange={e=>setIssue(v=>({...v,recurrence:e.target.value}))}><option>one-time</option><option>hourly</option><option>daily</option><option>weekly</option><option>monthly</option><option>frequent</option></select></label><label className="text-xs font-semibold text-ink-soft">Follow-up date<input type="date" value={issue.followUpDate} onChange={e=>setIssue(v=>({...v,followUpDate:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft sm:col-span-2">Root cause<input value={issue.rootCause} onChange={e=>setIssue(v=>({...v,rootCause:e.target.value}))} placeholder="Old pipe / motor overload / unknown"/></label><label className="text-xs font-semibold text-ink-soft sm:col-span-2">Action taken<input value={issue.actionTaken} onChange={e=>setIssue(v=>({...v,actionTaken:e.target.value}))} placeholder="Temporary repair / technician visit"/></label><label className="text-xs font-semibold text-ink-soft lg:col-span-4">Notes<textarea rows="3" value={issue.notes} onChange={e=>setIssue(v=>({...v,notes:e.target.value}))}/></label><label className="lg:col-span-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={issue.futureFlag} onChange={e=>setIssue(v=>({...v,futureFlag:e.target.checked}))}/> Mark this as a future warning so it is easy to find if the same problem becomes serious later.</label><button disabled={saving} className="lg:col-span-4 rounded-xl bg-brand text-white py-3 font-bold"><Save size={16} className="inline mr-1"/>Save problem history</button></form></Panel><Panel title="Past problems & future warnings" icon={AlertTriangle}><div className="space-y-2">{issues.map(i=><div key={i.id} className={`rounded-xl border p-3 ${i.futureFlag?'border-amber-300 bg-amber-50/40':'border-[var(--rm-border)]'}`}><div className="flex flex-col md:flex-row md:items-center justify-between gap-2"><div><p className="font-bold text-ink">{i.title}</p><p className="text-xs text-ink-soft">{houses.find(h=>h.id===i.houseId)?.internalDoorNumber || 'Apartment-wide'} · {i.category} · {i.severity} · {i.durationMinutes || 0} min · {i.recurrence}</p></div><button onClick={async()=>{await deleteApartmentIssue(i.id);setIssues(await listApartmentIssues(activeId))}} className="text-red-600 p-2" aria-label="Delete problem history"><Trash2 size={15}/></button></div>{i.notes&&<p className="text-sm text-ink-soft mt-2">{i.notes}</p>}{i.futureFlag&&<span className="inline-flex mt-2 rounded-full bg-amber-100 text-amber-800 px-2 py-1 text-[11px] font-bold">Future warning</span>}</div>)}{issues.length===0&&<p className="text-sm text-ink-soft">No problem history for this apartment.</p>}</div></Panel><Panel title="House problem count" icon={Wrench}><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{problemByHouse.map(h=><div key={h.id} className="rounded-xl border border-[var(--rm-border)] p-3"><p className="font-bold text-ink">{h.internalDoorNumber}</p><p className="text-xs text-ink-soft">{h.count} recorded problem(s)</p></div>)}</div></Panel></div>}

    {tab==='cctv' && <div className="space-y-5"><Panel title="CCTV cameras & warranty" icon={Camera}><form onSubmit={saveCamera} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-xs font-semibold text-ink-soft">Camera name<input required value={camera.name} onChange={e=>setCamera(v=>({...v,name:e.target.value}))} placeholder="Camera 1"/></label><label className="text-xs font-semibold text-ink-soft">House<select value={camera.houseId} onChange={e=>setCamera(v=>({...v,houseId:e.target.value}))}><option value="">Apartment/common</option>{houses.map(h=><option key={h.id} value={h.id}>{h.internalDoorNumber}</option>)}</select></label><label className="text-xs font-semibold text-ink-soft">Location<input value={camera.location} onChange={e=>setCamera(v=>({...v,location:e.target.value}))} placeholder="Gate"/></label><label className="text-xs font-semibold text-ink-soft">Direction<input value={camera.direction} onChange={e=>setCamera(v=>({...v,direction:e.target.value}))} placeholder="West"/></label><label className="text-xs font-semibold text-ink-soft">Main box / NVR location<input value={camera.mainBoxLocation} onChange={e=>setCamera(v=>({...v,mainBoxLocation:e.target.value}))} placeholder="Office cupboard"/></label><label className="text-xs font-semibold text-ink-soft">Login username<input value={camera.loginUsername} onChange={e=>setCamera(v=>({...v,loginUsername:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">Credential vault reference<input value={camera.credentialVaultRef} onChange={e=>setCamera(v=>({...v,credentialVaultRef:e.target.value}))} placeholder="Password manager entry / secure reference"/></label><label className="text-xs font-semibold text-ink-soft">Purchase date<input type="date" value={camera.purchaseDate} onChange={e=>setCamera(v=>({...v,purchaseDate:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">Warranty months<input type="number" min="0" value={camera.warrantyMonths} onChange={e=>setCamera(v=>({...v,warrantyMonths:Number(e.target.value)}))}/></label><label className="text-xs font-semibold text-ink-soft lg:col-span-3">Notes<input value={camera.notes} onChange={e=>setCamera(v=>({...v,notes:e.target.value}))} placeholder="Camera purchased this year; keep original invoice separately."/></label><button disabled={saving} className="rounded-xl bg-brand text-white py-3 font-bold"><Save size={15} className="inline mr-1"/>Save camera</button></form><div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">For security, this app does not store a CCTV password or unlock pattern in plain text. Put the actual secret in a password manager/secure vault and record only its reference here. Never paste a real CCTV password into ordinary notes.</div><div className="mt-4 grid sm:grid-cols-2 gap-3">{cameras.map(c=>{const w=warrantyStatus(c);return <div key={c.id} className="rounded-2xl border border-[var(--rm-border)] p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-ink">{c.name}</p><p className="text-xs text-ink-soft">{c.location||'Location not set'}{c.direction?` · facing ${c.direction}`:''}</p></div><span className={`text-xs font-bold rounded-full px-2 py-1 ${w.expired?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{w.label}</span></div><p className="text-xs text-ink-soft mt-2">Main box: {c.mainBoxLocation||'—'} · Username: {c.loginUsername||'—'}</p><button onClick={async()=>{await deleteCctvCamera(c.id);setCameras(await listCctvCameras(activeId))}} className="mt-3 text-red-600 text-xs font-bold">Delete camera</button></div>})}{cameras.length===0&&<p className="text-sm text-ink-soft">No cameras recorded for this apartment.</p>}</div></Panel><Panel title="Footage request & copy log" icon={Video}><form onSubmit={saveRequest} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-xs font-semibold text-ink-soft">Camera<select value={request.cameraId} onChange={e=>setRequest(v=>({...v,cameraId:e.target.value}))}><option value="">Select camera</option>{cameras.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-xs font-semibold text-ink-soft">Requester name<input required value={request.requesterName} onChange={e=>setRequest(v=>({...v,requesterName:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">Contact<input value={request.requesterContact} onChange={e=>setRequest(v=>({...v,requesterContact:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">Footage date<input type="date" required value={request.footageDate} onChange={e=>setRequest(v=>({...v,footageDate:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">From time<input type="time" value={request.fromTime} onChange={e=>setRequest(v=>({...v,fromTime:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft">To time<input type="time" value={request.toTime} onChange={e=>setRequest(v=>({...v,toTime:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft lg:col-span-2">Purpose<input value={request.purpose} onChange={e=>setRequest(v=>({...v,purpose:e.target.value}))} placeholder="Requested for incident / verification"/></label><label className="text-xs font-semibold text-ink-soft lg:col-span-4">Notes<textarea rows="2" value={request.notes} onChange={e=>setRequest(v=>({...v,notes:e.target.value}))}/></label><label className="text-xs font-semibold text-ink-soft lg:col-span-4">Recorded copy (private)<input type="file" accept="video/*,image/*,.zip" onChange={e=>setFootageFile(e.target.files?.[0]||null)} /><span className="block mt-1 text-[11px] font-normal">The file is uploaded as a private authenticated Cloudinary asset; only owner-level users can request a short-lived viewing URL.</span></label><label className="lg:col-span-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={request.recordCopied} onChange={e=>setRequest(v=>({...v,recordCopied:e.target.checked}))}/> Record copy was taken and stored in the log.</label><button disabled={saving} className="lg:col-span-4 rounded-xl bg-brand text-white py-3 font-bold"><Save size={15} className="inline mr-1"/>Save footage record</button></form><div className="mt-4 space-y-2">{footage.map(f=><div key={f.id} className="rounded-xl border border-[var(--rm-border)] p-3"><p className="font-bold text-ink">{f.requesterName} · {f.footageDate} {f.fromTime||''}-{f.toTime||''}</p><p className="text-xs text-ink-soft mt-1">{cameras.find(c=>c.id===f.cameraId)?.name||'Camera'} · {f.purpose||'No purpose entered'} · {f.recordCopied?'Copy recorded':'No copy marked'}{f.copyFileName?` · ${f.copyFileName}`:''}</p>{f.copyPublicId&&<button type="button" onClick={async()=>{try{const url=await getPrivateViewUrl(f.copyPublicId,f.copyResourceType||'video');window.open(url,'_blank','noopener,noreferrer')}catch(e){setError(e.message)}}} className="mt-2 text-xs font-bold text-brand hover:underline">Open private copy</button>}</div>)}{footage.length===0&&<p className="text-sm text-ink-soft">No footage requests recorded yet.</p>}</div></Panel></div>}
  </div>
}
