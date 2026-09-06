import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DoorOpen, Phone, X } from 'lucide-react'
import TextField from '../shared/ui/TextField'
import SelectField from '../shared/ui/SelectField'
import Button from '../shared/ui/Button'
import IconButton from '../shared/ui/IconButton'
import { listHouses, bookHouse, vacateHouse } from '../../services/houseService'
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

export default function HouseManager() {
  const { user } = useAuth()
  const [houses, setHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingHouse, setBookingHouse] = useState(null)
  const [vacatingHouse, setVacatingHouse] = useState(null)
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
            {occupiedCount} occupied · {houses.length - occupiedCount} vacant · {houses.length} total
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
              onClick={() => bulkMode && toggleSelection(h.id)}
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
                    {!bulkMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setVacatingHouse(h) }}
                        className="mt-3 text-xs text-stamp-red font-medium hover:underline"
                      >
                        Mark Vacate
                      </button>
                    )}
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


function BookHouseModal({ house, user, onClose, onDone }) {
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', rentAmount: '', advanceAmount: '', aadhaarNumber: '', phoneVisibleToNeighbors: true,
    moveInDate: '', advancePaidNow: '',
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
    advancePaidNow: touched.advancePaidNow && form.advanceAmount && Number(form.advancePaidNow) > Number(form.advanceAmount)
      ? `Can't exceed the agreed advance of ₹${form.advanceAmount}.` : '',
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function submit(e) {
    e.preventDefault()
    setTouched({ email: true, phone: true, password: true, rentAmount: true, advancePaidNow: true })
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
        email: form.email,
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
        email: form.email,
        rentAmount: Number(form.rentAmount),
        advanceAmount: Number(form.advanceAmount),
        phoneVisibleToNeighbors: form.phoneVisibleToNeighbors,
        moveInDate: form.moveInDate,
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
          <p className="text-xs text-ink-soft">They can sign in with this ID + the password you set, with their email + password, or with Google.</p>
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
          label="Email" hint="Used as their login" type="email" required value={form.email}
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
