import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DoorOpen, Phone, X, Users, IndianRupee, CalendarDays, History, ChevronRight, MoreHorizontal, ShieldCheck } from 'lucide-react'
import TextField from '../shared/ui/TextField'
import SelectField from '../shared/ui/SelectField'
import Button from '../shared/ui/Button'
import IconButton from '../shared/ui/IconButton'
import { listHouses, getHouseHistory, bookHouse, vacateHouse, updateHouseDetails } from '../../services/houseService'
import { createTenantAccount } from '../../services/authService'
import { addAdvancePayment } from '../../services/advanceLedgerService'
import { uploadUnsigned } from '../../services/cloudinaryService'
import { getCashReceivers } from '../../services/configService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'
import { SkeletonCard } from '../shared/ui/Skeleton'
import BulkActions from './BulkActions'
import { useNavigate } from 'react-router-dom'
import { createNotification } from '../../services/notificationService'
import { listRentHistory } from '../../services/rentService'
import { listHouseTenantAccounts } from '../../services/tenantAccountService'

export default function HouseManager() {
  const { user } = useAuth()
  const [houses, setHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingHouse, setBookingHouse] = useState(null)
  const [vacatingHouse, setVacatingHouse] = useState(null)
  const [detailHouse, setDetailHouse] = useState(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedHouseIds, setSelectedHouseIds] = useState(new Set())
  const toast = useToast()

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    setHouses(await listHouses())
    setLoading(false)
  }

  const navigate = useNavigate()

  function toggleSelection(houseId) {
    const next = new Set(selectedHouseIds)
    if (next.has(houseId)) next.delete(houseId)
    else next.add(houseId)
    setSelectedHouseIds(next)
  }

  function toggleSelectAll() {
    if (selectedHouseIds.size === houses.length) {
      setSelectedHouseIds(new Set())
    } else {
      setSelectedHouseIds(new Set(houses.map(h => h.id)))
    }
  }

  async function handleBulkAction(action) {
    const selected = houses.filter(h => selectedHouseIds.has(h.id))
    if (action === 'notice') {
      navigate('/owner/notices', { state: { preselectHouses: selected.map(h => h.id) } })
    } else if (action === 'reminder') {
      try {
        let count = 0
        for (const h of selected) {
          if (h.status === 'occupied' && h.currentTenantId) {
            await createNotification({
              recipientId: h.currentTenantId,
              recipientType: 'tenant',
              type: 'payment_reminder',
              title: 'Payment Reminder',
              message: 'This is a friendly reminder for your pending payments.'
            })
            count++
          }
        }
        toast.success(`Sent reminders to ${count} tenants`)
        setSelectedHouseIds(new Set())
        setBulkMode(false)
      } catch (err) {
        toast.error('Failed to send reminders')
      }
    }
  }

  const occupiedCount = houses.filter((h) => h.status === 'occupied').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Houses</h2>
          <p className="font-mono-tab text-xs text-ink-soft mt-0.5">
            {occupiedCount} occupied · {houses.length} total · tap a house for its complete profile
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bulkMode && (
            <button onClick={toggleSelectAll} className="text-sm font-medium text-ink bg-paper border border-brass/30 px-3 py-1.5 rounded-lg hover:bg-black/5">
              {selectedHouseIds.size === houses.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          <button 
            onClick={() => { setBulkMode(!bulkMode); setSelectedHouseIds(new Set()) }}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${bulkMode ? 'bg-cover text-white' : 'bg-paper border border-brass/30 text-ink hover:bg-black/5'}`}
          >
            {bulkMode ? 'Cancel Bulk' : 'Bulk Select'}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={`skeleton-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <SkeletonCard />
            </motion.div>
          ))
        ) : (
          houses.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={`bg-paper-raised rounded-2xl shadow-sm border overflow-hidden transition-colors ${selectedHouseIds.has(h.id) ? 'border-cover' : 'border-brass/20'}`}
              onClick={() => bulkMode ? toggleSelection(h.id) : setDetailHouse(h)}
            >
              {/* Door plate header */}
              <div className="bg-cover text-paper px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {bulkMode && (
                    <input 
                      type="checkbox" 
                      checked={selectedHouseIds.has(h.id)}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-cover border-paper bg-white cursor-pointer mr-2 accent-brass"
                    />
                  )}
                  <DoorOpen size={16} className="text-brass-light" />
                  <span className="font-display text-lg tracking-wide">{h.internalDoorNumber}</span>
                </div>
                <span className={`stamp ${h.status === 'occupied' ? 'stamp-green' : 'stamp-ink'} !rotate-0 !text-[0.62rem]`}>
                  {h.status}
                </span>
              </div>

              <div className="p-4">
                <p className="text-xs text-ink-soft mb-2">Govt door no: {h.govtDoorNumber}</p>
                {h.status === 'occupied' ? (
                  <>
                    <p className="text-sm font-medium text-ink">{h.tenantName}</p>
                    <p className="text-xs text-ink-soft flex items-center gap-1 mt-0.5"><Phone size={11} />{h.tenantPhone}</p>
                    <p className="font-mono-tab text-sm text-brass mt-2">₹{h.rentAmount}<span className="text-ink-soft">/mo</span></p>
                    <p className="mt-3 text-xs text-ink-soft">Tap for complete house details →</p>
                  </>
                ) : (
                  !bulkMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setBookingHouse(h) }}
                      className="mt-1 text-xs bg-cover text-paper px-3 py-1.5 rounded-full font-medium hover:bg-cover-dark transition"
                    >
                      Book this house
                    </button>
                  )
                )}
              </div>
            </motion.div>
          ))
        )}
        {!loading && houses.length === 0 && (
          <p className="text-sm text-ink-soft col-span-full">
            No houses yet — add your properties once under More → Property Setup, then manage bookings and vacates here.
          </p>
        )}
      </div>

      {detailHouse && (
        <HouseDetailModal
          house={detailHouse}
          user={user}
          onClose={() => setDetailHouse(null)}
          onVacate={() => { setVacatingHouse(detailHouse); setDetailHouse(null) }}
          onBook={() => { setBookingHouse(detailHouse); setDetailHouse(null) }}
        />
      )}

      {bookingHouse && (
        <BookHouseModal house={bookingHouse} user={user} onClose={() => setBookingHouse(null)} onDone={refresh} />
      )}
      {vacatingHouse && (
        <VacateHouseModal house={vacatingHouse} user={user} onClose={() => setVacatingHouse(null)} onDone={refresh} />
      )}
      
      <BulkActions 
        selectedHouses={houses.filter(h => selectedHouseIds.has(h.id))}
        onAction={handleBulkAction}
        onClear={() => setSelectedHouseIds(new Set())}
      />
    </div>
  )
}


function HouseDetailModal({ house, user, onClose, onVacate, onBook }) {
  const [tab, setTab] = useState('overview')
  const [history, setHistory] = useState([])
  const [payments, setPayments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailSaving, setDetailSaving] = useState(false)
  const [houseColors, setHouseColors] = useState({ exterior:'#172033', hall:'#f5f5f5', kitchen:'#f5f5f5', bathroom:'#f5f5f5', bedroom:'#f5f5f5' })
  const [fixtures, setFixtures] = useState([])
  const [ownerNotes, setOwnerNotes] = useState('')

  useEffect(() => {
    setHouseColors({ exterior:'#172033', hall:'#f5f5f5', kitchen:'#f5f5f5', bathroom:'#f5f5f5', bedroom:'#f5f5f5', ...(house.houseColors || {}) })
    setFixtures(Array.isArray(house.providedFixtures) ? house.providedFixtures : [])
    setOwnerNotes(house.ownerNotes || '')
  }, [house.id])

  useEffect(() => {
    let live = true
    Promise.all([getHouseHistory(house.id), listRentHistory(house.id), listHouseTenantAccounts(house.id)])
      .then(([h, p, a]) => { if (live) { setHistory(h); setPayments(p); setAccounts(a); setLoading(false) } })
      .catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [house.id])

  const approved = payments.filter(p => p.status === 'approved')
  const paidTotal = approved.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const currentAccountCount = accounts.length
  const currentMembers = Number(house.memberCount || house.familyMemberCount || currentAccountCount || 1)
  const currentHistory = history.find(h => !h.movedOutAt)
  async function saveHouseDetails() {
    setDetailSaving(true)
    try { await updateHouseDetails(house.id, { colors: houseColors, fixtures, notes: ownerNotes }); window.dispatchEvent(new CustomEvent('rm:house-details-updated', { detail: { houseId: house.id, colors: houseColors, fixtures } })) }
    catch (e) { console.error(e) }
    finally { setDetailSaving(false) }
  }
  function addFixture() { setFixtures(v => [...v, { name:'', quantity:1, notes:'' }]) }
  function patchFixture(index, patch) { setFixtures(v => v.map((x,i)=>i===index?{...x,...patch}:x)) }

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-3xl max-h-[94vh] sm:max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-paper-raised border border-[var(--rm-border)] shadow-2xl flex flex-col">
        <div className="px-5 sm:px-7 py-5 bg-cover text-paper flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-brass-light font-bold">House profile</p>
            <h2 className="font-display text-2xl font-extrabold mt-1">{house.internalDoorNumber}</h2>
            <p className="text-sm text-paper/70 mt-1">{house.govtDoorNumber || 'Government door number not set'}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center" aria-label="Close"><X size={20}/></button>
        </div>

        <div className="px-4 sm:px-7 pt-3 border-b border-[var(--rm-border)] overflow-x-auto sticky top-0 bg-paper-raised z-10">
          <div className="flex gap-1 min-w-max pb-0.5">
            {[['overview','Overview'],['residents','Residents'],['rent','Rent history'],['history','Occupancy history']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold ${tab===id ? 'text-brand border-b-2 border-brand bg-brand/5' : 'text-ink-soft'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-5 sm:p-7">
          {loading ? <div className="py-14 text-center text-sm text-ink-soft">Loading house history…</div> : (
            <>
              {tab === 'overview' && <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <InfoStat icon={DoorOpen} label="Status" value={house.status === 'occupied' ? 'Occupied' : 'Vacant'} />
                  <InfoStat icon={Users} label="People" value={currentMembers} />
                  <InfoStat icon={IndianRupee} label="Monthly rent" value={house.status === 'occupied' ? `₹${Number(house.rentAmount || 0).toLocaleString('en-IN')}` : '—'} />
                  <InfoStat icon={CalendarDays} label="Moved in" value={house.moveInDate || '—'} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <DetailCard title="Current resident" icon={Users}>
                    {house.status === 'occupied' ? <>
                      <p className="font-semibold text-ink">{house.tenantName}</p>
                      <p className="text-sm text-ink-soft mt-1">{house.tenantPhone || 'No phone'} · {house.tenantEmail || 'No email'}</p>
                      <p className="text-xs text-ink-soft mt-3">Move-in: {house.moveInDate || 'Not recorded'}</p>
                      <p className="text-xs text-ink-soft">Members: {currentMembers}</p>
                    </> : <p className="text-sm text-ink-soft">Currently vacant. Previous residents remain available in Occupancy history.</p>}
                  </DetailCard>
                  <DetailCard title="Property details" icon={DoorOpen}>
                    <p className="text-sm text-ink-soft">Floor: <span className="text-ink font-medium">{house.floor || '—'}</span></p>
                    <p className="text-sm text-ink-soft mt-2">EB number: <span className="text-ink font-medium">{house.ebNumber || '—'}</span></p>
                    <p className="text-sm text-ink-soft mt-2">Advance: <span className="text-ink font-medium">{house.status === 'occupied' ? `₹${Number(house.advanceAmount || 0).toLocaleString('en-IN')}` : '—'}</span></p>
                    <p className="text-sm text-ink-soft mt-2">Total approved rent recorded: <span className="text-ink font-medium">₹{paidTotal.toLocaleString('en-IN')}</span></p>
                  </DetailCard>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {house.status === 'occupied' ? <button onClick={onVacate} className="px-4 py-2.5 rounded-xl border border-stamp-red/30 text-stamp-red text-sm font-semibold hover:bg-stamp-red/5">More actions · Vacate house</button> : <button onClick={onBook} className="px-4 py-2.5 rounded-xl bg-brand !text-white text-sm font-semibold">Book this house</button>}
                  <span className="px-4 py-2.5 rounded-xl bg-paper border border-[var(--rm-border)] text-sm text-ink-soft">Created {house.createdAt ? new Date(house.createdAt).toLocaleDateString('en-IN') : '—'}</span>
                </div>
                <DetailCard title="Paint & room colours" icon={DoorOpen}>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{[['exterior','Exterior'],['hall','Hall'],['kitchen','Kitchen'],['bathroom','Bathroom'],['bedroom','Bedroom']].map(([key,label])=><label key={key} className="text-xs font-semibold text-ink-soft">{label}<div className="flex items-center gap-2 mt-1"><input type="color" value={houseColors[key] || '#f5f5f5'} onChange={e=>setHouseColors(v=>({...v,[key]:e.target.value}))} className="h-10 w-10 p-1 rounded-lg"/><input value={houseColors[key] || ''} onChange={e=>setHouseColors(v=>({...v,[key]:e.target.value}))} className="min-w-0 text-xs" placeholder="#RRGGBB"/></div></label>)}</div>
                  <p className="text-xs text-ink-soft mt-3">Keep these saved so repainting or repair work can match each room later.</p>
                </DetailCard>
                <DetailCard title="Items provided with this house" icon={DoorOpen}>
                  <div className="space-y-2">{fixtures.map((item,index)=><div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_70px_1fr_auto] gap-2 items-center"><input value={item.name} onChange={e=>patchFixture(index,{name:e.target.value})} placeholder="Fan / light / calling bell"/><input type="number" min="1" value={item.quantity} onChange={e=>patchFixture(index,{quantity:Number(e.target.value||1)})}/><input value={item.notes||''} onChange={e=>patchFixture(index,{notes:e.target.value})} placeholder="Notes"/><button onClick={()=>setFixtures(v=>v.filter((_,i)=>i!==index))} className="text-red-600">×</button></div>)}<button onClick={addFixture} className="text-sm font-bold text-brand">+ Add item</button></div>
                </DetailCard>
                <DetailCard title="Owner notes" icon={DoorOpen}><textarea value={ownerNotes} onChange={e=>setOwnerNotes(e.target.value)} placeholder="Repair notes, special fittings, repaint notes…" className="w-full min-h-24"/><button disabled={detailSaving} onClick={saveHouseDetails} className="mt-3 rounded-xl bg-brand text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">{detailSaving?'Saving…':'Save house details'}</button></DetailCard>
              </div>}

              {tab === 'residents' && <div className="space-y-3">
                <div className="flex items-center justify-between mb-2"><div><h3 className="font-display text-lg font-bold text-ink">Accounts & household</h3><p className="text-sm text-ink-soft">{accounts.length} login account{accounts.length === 1 ? '' : 's'} · up to 5 family accounts</p></div><ShieldCheck className="text-brand"/></div>
                {accounts.length ? accounts.map(a => <div key={a.uid} className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4 flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">{(a.name || '?')[0]}</div><div className="min-w-0 flex-1"><p className="font-semibold text-ink truncate">{a.name}</p><p className="text-xs text-ink-soft truncate">{a.accountType === 'sub' ? `${a.relationship || 'Family member'} · Family account` : 'Main tenant account'}</p><p className="text-xs text-ink-soft truncate">{a.email || 'No email'}</p></div><span className="text-xs rounded-full px-2.5 py-1 bg-brand/10 text-brand font-semibold">{a.accountType === 'sub' ? 'Sub account' : 'Main'}</span></div>) : <p className="text-sm text-ink-soft py-8 text-center">No tenant accounts found.</p>}
              </div>}

              {tab === 'rent' && <div><div className="grid grid-cols-2 gap-3 mb-4"><InfoStat icon={IndianRupee} label="Approved total" value={`₹${paidTotal.toLocaleString('en-IN')}`} /><InfoStat icon={History} label="Payments" value={payments.length} /></div><div className="space-y-2">{payments.slice(0, 30).map(p => <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-paper border border-[var(--rm-border)]"><div className="flex-1"><p className="text-sm font-semibold text-ink">{p.month}</p><p className="text-xs text-ink-soft">{p.mode || '—'} · {p.tenantId === house.currentTenantId ? 'Current tenant' : 'House account'}</p></div><p className="font-mono-tab text-sm text-ink">₹{Number(p.amount || 0).toLocaleString('en-IN')}</p><span className={`text-[10px] px-2 py-1 rounded-full font-bold ${p.status==='approved'?'bg-emerald-100 text-emerald-700':p.status==='waiting_approval'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{p.status.replace('_',' ')}</span></div>)}{payments.length===0 && <p className="text-sm text-ink-soft py-8 text-center">No rent payments recorded yet.</p>}</div></div>}

              {tab === 'history' && <div className="space-y-3">{history.map((h, i) => <div key={h.id} className="relative pl-7 pb-3"><div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-brand ring-4 ring-brand/10"/><div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink">{h.name || 'Resident'}</p><p className="text-xs text-ink-soft mt-1">Moved in {h.moveInDate || (h.movedInAt ? new Date(h.movedInAt).toLocaleDateString('en-IN') : '—')}</p></div><span className="text-xs rounded-full px-2.5 py-1 bg-paper-raised border border-[var(--rm-border)] text-ink-soft">{h.movedOutAt ? 'Past resident' : 'Current'}</span></div>{h.movedOutAt && <p className="text-xs text-ink-soft mt-3">Moved out {new Date(h.movedOutAt).toLocaleDateString('en-IN')} · Advance deducted ₹{Number(h.advanceDeducted || 0).toLocaleString('en-IN')} · Returned ₹{Number(h.balanceReturned || 0).toLocaleString('en-IN')}</p>}</div></div>)}{history.length===0 && <p className="text-sm text-ink-soft py-8 text-center">No occupancy history yet.</p>}</div>}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function InfoStat({ icon: Icon, label, value }) {
  return <div className="rounded-2xl bg-paper border border-[var(--rm-border)] p-4"><Icon size={17} className="text-brand"/><p className="text-lg font-bold text-ink mt-2 truncate">{value}</p><p className="text-xs text-ink-soft mt-0.5">{label}</p></div>
}

function DetailCard({ title, icon: Icon, children }) {
  return <section className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4"><div className="flex items-center gap-2 mb-3"><Icon size={16} className="text-brand"/><h3 className="font-semibold text-ink">{title}</h3></div>{children}</section>
}


function BookHouseModal({ house, user, onClose, onDone }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', rentAmount: '', advanceAmount: '', aadhaarNumber: '', phoneVisibleToNeighbors: true,
    moveInDate: '', advancePaidNow: '', memberCount: '1',
  })
  const [touched, setTouched] = useState({})
  const [photoFile, setPhotoFile] = useState(null)
  const [customerId, setCustomerId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function touch(field) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  // Instant inline validation, including a genuinely useful business-rule
  // check: the advance paid today can't exceed the agreed target — catches a
  // real data-entry mistake before it's saved, not just required-field checks.
  const errors = {
    email: touched.email && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
      ? 'Enter a valid email address.' : '',
    phone: touched.phone && form.phone && form.phone.replace(/\D/g, '').length < 10
      ? 'Enter a valid 10-digit phone number.' : '',
    password: touched.password && form.password && form.password.length < 6
      ? 'Password should be at least 6 characters.' : '',
    rentAmount: touched.rentAmount && form.rentAmount && Number(form.rentAmount) <= 0
      ? 'Rent must be greater than ₹0.' : '',
    memberCount: touched.memberCount && (Number(form.memberCount) < 1 || Number(form.memberCount) > 20) ? 'Enter 1–20 household members.' : '',
    advancePaidNow: touched.advancePaidNow && form.advanceAmount && Number(form.advancePaidNow) > Number(form.advanceAmount)
      ? `Can't exceed the agreed advance of ₹${form.advanceAmount}.` : '',
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function submit(e) {
    e.preventDefault()
    setTouched({ email: true, phone: true, password: true, rentAmount: true, advancePaidNow: true, memberCount: true })
    if (hasErrors) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const recordedBy = { uid: user.uid, name: user.name }
      let photoUrl = null
      if (photoFile) {
        const uploaded = await uploadUnsigned(photoFile, `tenant-photos/${house.id}`)
        photoUrl = uploaded.url
      }
      const tenant = await createTenantAccount({
        email: form.email || undefined,
        password: form.password,
        name: form.name,
        phone: form.phone,
        houseId: house.id,
        aadhaarNumber: form.aadhaarNumber,
      })
      await bookHouse(house.id, {
        tenantId: tenant.uid,
        name: form.name,
        phone: form.phone,
        email: form.email || '',
        rentAmount: Number(form.rentAmount),
        advanceAmount: Number(form.advanceAmount),
        phoneVisibleToNeighbors: form.phoneVisibleToNeighbors,
        moveInDate: form.moveInDate,
        memberCount: Number(form.memberCount || 1),
        recordedBy,
        photoUrl,
      })
      // Advance is often paid partially — e.g. ₹5,000 now, the rest added over
      // future months. Whatever's paid at booking becomes the first ledger entry;
      // more can be added later from the tenant's profile.
      if (Number(form.advancePaidNow) > 0) {
        await addAdvancePayment({
          houseId: house.id,
          tenantId: tenant.uid,
          amount: Number(form.advancePaidNow),
          date: form.moveInDate || new Date().toISOString().slice(0, 10),
          mode: 'cash',
          note: 'Paid at booking',
          recordedBy,
        })
      }
      setCustomerId(tenant.customerId)
      showToast({ message: "House booked successfully!", type: "success" })
      onDone()
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong — please try again.')
      showToast({ message: err.message || 'Failed to book house', type: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  if (customerId) {
    return (
      <Modal title="House Booked" onClose={onClose}>
        <div className="text-center space-y-2 py-2">
          <p className="text-sm text-ink-soft">Tenant login created. Share this Customer ID with them —</p>
          <p className="text-2xl font-semibold text-brand">{customerId}</p>
          <p className="text-xs text-ink-soft">If an email was not entered, link their email later from the tenant profile before login is given.</p>
          <Button onClick={onClose} fullWidth className="mt-4">Done</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Book ${house.internalDoorNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <TextField label="Tenant name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField
          label="Phone" required inputMode="tel" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => touch('phone')}
          error={errors.phone}
        />
        <TextField
          label="Email" hint="Optional now. You can link their email later when you give them login access." type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => touch('email')}
          error={errors.email}
        />
        <TextField
          label="Temporary password" type="password" required value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} onBlur={() => touch('password')}
          error={errors.password}
        />
        <TextField
          label="Aadhaar number" hint="Optional — links repeat tenants to one Customer ID"
          value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
        />
        <div>
          <label className="text-sm text-ink-soft" htmlFor="tenant-photo">Profile photo (optional)</label>
          <input id="tenant-photo" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} className="w-full text-sm mt-1" />
        </div>
        <TextField
          label="Move-in date" type="date" required value={form.moveInDate}
          onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
        />
        <TextField
          label="Rent amount" type="number" required value={form.rentAmount}
          onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} onBlur={() => touch('rentAmount')}
          error={errors.rentAmount}
        />
        <TextField
          label="Advance amount agreed (target)" type="number" required value={form.advanceAmount}
          onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
        />
        <TextField
          label="Advance actually paid now" hint="Can be less — add the rest later from their profile"
          type="number" placeholder="e.g. 5000" value={form.advancePaidNow}
          onChange={(e) => setForm({ ...form, advancePaidNow: e.target.value })} onBlur={() => touch('advancePaidNow')}
          error={errors.advancePaidNow}
        />
        <TextField label="Household members" hint="Used for the house profile. You can create separate family logins after booking." type="number" min="1" max="20" value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })} onBlur={() => touch('memberCount')} error={errors.memberCount} />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={form.phoneVisibleToNeighbors} onChange={(e) => setForm({ ...form, phoneVisibleToNeighbors: e.target.checked })} />
          Show phone number to neighbors in directory
        </label>
        {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
        <Button type="submit" fullWidth loading={submitting} loadingText="Booking…">Book House</Button>
      </form>
    </Modal>
  )
}

function VacateHouseModal({ house, user, onClose, onDone }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    advanceDeducted: '', deductionReason: '', balanceReturned: '', returnDate: '', returnMode: 'cash', returnedBy: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [cashReceivers, setCashReceivers] = useState([])

  useEffect(() => {
    getCashReceivers().then((receivers) => {
      setCashReceivers(receivers)
      if (receivers.length > 0) {
        setForm((prev) => ({ ...prev, returnedBy: receivers[0] }))
      }
    }).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load cash receivers", type: "error" })
    })
  }, [showToast])

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await vacateHouse(house.id, {
        advanceDeducted: Number(form.advanceDeducted || 0),
        deductionReason: form.deductionReason,
        balanceReturned: Number(form.balanceReturned || 0),
        returnDate: form.returnDate,
        returnMode: form.returnMode,
        returnedBy: form.returnedBy,
        recordedBy: { uid: user.uid, name: user.name },
      })
      showToast({ message: "House vacated successfully", type: "success" })
      onDone()
      onClose()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to mark as vacated", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Vacate ${house.internalDoorNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <TextField label="Advance deducted (₹)" type="number" value={form.advanceDeducted} onChange={(e) => setForm({ ...form, advanceDeducted: e.target.value })} />
        <TextField label="Reason for deduction" value={form.deductionReason} onChange={(e) => setForm({ ...form, deductionReason: e.target.value })} />
        <TextField label="Balance returned (₹)" type="number" value={form.balanceReturned} onChange={(e) => setForm({ ...form, balanceReturned: e.target.value })} />
        <TextField label="Return date" type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
        <SelectField label="Return mode" value={form.returnMode} onChange={(e) => setForm({ ...form, returnMode: e.target.value })}>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
        </SelectField>
        <SelectField label="Returned by" value={form.returnedBy} onChange={(e) => setForm({ ...form, returnedBy: e.target.value })}>
          {cashReceivers.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          <option value="others">Others</option>
        </SelectField>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Tenant access will be revoked automatically 1 hour after this is submitted.
        </p>
        <Button type="submit" variant="danger" fullWidth loading={submitting} loadingText="Vacating…">Confirm Vacate</Button>
      </form>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 id="modal-title" className="font-semibold text-ink font-display text-lg">{title}</h3>
          <IconButton icon={X} label="Close dialog" onClick={onClose} className="text-ink-soft hover:text-ink" />
        </div>
        {children}
      </div>
    </div>
  )
}
