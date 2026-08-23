import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DoorOpen, Phone } from 'lucide-react'
import { listHouses, bookHouse, vacateHouse } from '../../services/houseService'
import { createTenantAccount } from '../../services/authService'
import { addAdvancePayment } from '../../services/advanceLedgerService'
import { uploadUnsigned } from '../../services/cloudinaryService'
import { useAuth } from '../../context/AuthContext'

export default function HouseManager() {
  const { user } = useAuth()
  const [houses, setHouses] = useState([])
  const [bookingHouse, setBookingHouse] = useState(null)
  const [vacatingHouse, setVacatingHouse] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
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
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {houses.map((h, i) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-paper-raised rounded-2xl shadow-sm border border-brass/20 overflow-hidden"
          >
            {/* Door plate header */}
            <div className="bg-cover text-paper px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                  <button
                    onClick={() => setVacatingHouse(h)}
                    className="mt-3 text-xs text-stamp-red font-medium hover:underline"
                  >
                    Mark Vacate
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setBookingHouse(h)}
                  className="mt-1 text-xs bg-cover text-paper px-3 py-1.5 rounded-full font-medium hover:bg-cover-dark transition"
                >
                  Book this house
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {houses.length === 0 && (
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
    </div>
  )
}


function BookHouseModal({ house, user, onClose, onDone }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', rentAmount: '', advanceAmount: '', aadhaarNumber: '', phoneVisibleToNeighbors: true,
    moveInDate: '', advancePaidNow: '',
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [customerId, setCustomerId] = useState(null)

  async function submit(e) {
    e.preventDefault()
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
    onDone()
  }

  if (customerId) {
    return (
      <Modal title="House Booked" onClose={onClose}>
        <div className="text-center space-y-2 py-2">
          <p className="text-sm text-slate-600">Tenant login created. Share this Customer ID with them —</p>
          <p className="text-2xl font-semibold text-brand">{customerId}</p>
          <p className="text-xs text-slate-400">They can sign in with this ID + the password you set, with their email + password, or with Google.</p>
          <button onClick={onClose} className="mt-4 w-full bg-brand text-white py-2 rounded-lg text-sm font-medium">Done</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Book ${house.internalDoorNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input required placeholder="Tenant name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email (used as login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Aadhaar number (links repeat tenants to one Customer ID)" value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div>
          <label className="text-xs text-slate-500">Profile photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} className="w-full text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Move-in date</label>
          <input required type="date" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
        <input required type="number" placeholder="Rent amount" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required type="number" placeholder="Advance amount agreed (target)" value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <div>
          <label className="text-xs text-slate-500">Advance actually paid now (can be less — add the rest later)</label>
          <input type="number" placeholder="e.g. 5000" value={form.advancePaidNow} onChange={(e) => setForm({ ...form, advancePaidNow: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.phoneVisibleToNeighbors} onChange={(e) => setForm({ ...form, phoneVisibleToNeighbors: e.target.checked })} />
          Show phone number to neighbors in directory
        </label>
        <button className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium">Book House</button>
      </form>
    </Modal>
  )
}

function VacateHouseModal({ house, user, onClose, onDone }) {
  const [form, setForm] = useState({
    advanceDeducted: '', deductionReason: '', balanceReturned: '', returnDate: '', returnMode: 'cash', returnedBy: 'deepu',
  })
  async function submit(e) {
    e.preventDefault()
    await vacateHouse(house.id, {
      advanceDeducted: Number(form.advanceDeducted || 0),
      deductionReason: form.deductionReason,
      balanceReturned: Number(form.balanceReturned || 0),
      returnDate: form.returnDate,
      returnMode: form.returnMode,
      returnedBy: form.returnedBy,
      recordedBy: { uid: user.uid, name: user.name },
    })
    onDone()
    onClose()
  }
  return (
    <Modal title={`Vacate ${house.internalDoorNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input type="number" placeholder="Advance deducted (₹)" value={form.advanceDeducted} onChange={(e) => setForm({ ...form, advanceDeducted: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Reason for deduction" value={form.deductionReason} onChange={(e) => setForm({ ...form, deductionReason: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input type="number" placeholder="Balance returned (₹)" value={form.balanceReturned} onChange={(e) => setForm({ ...form, balanceReturned: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <select value={form.returnMode} onChange={(e) => setForm({ ...form, returnMode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
        </select>
        <select value={form.returnedBy} onChange={(e) => setForm({ ...form, returnedBy: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="deepu">Deepu</option>
          <option value="rajavel">Rajavel</option>
          <option value="siva">Siva</option>
        </select>
        <p className="text-xs text-amber-600">Tenant access will be revoked automatically 1 hour after this is submitted.</p>
        <button className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Confirm Vacate</button>
      </form>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
