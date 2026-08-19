import { useEffect, useState } from 'react'
import { listHouses, createHouse, bookHouse, vacateHouse } from '../../services/houseService'
import { createTenantAccount } from '../../services/authService'

export default function HouseManager() {
  const [houses, setHouses] = useState([])
  const [showCreate, setShowCreate] = useState(false)
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
          <h2 className="text-lg font-semibold text-slate-800">Houses</h2>
          <p className="text-sm text-slate-500">
            {occupiedCount} occupied · {houses.length - occupiedCount} vacant · {houses.length} total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark self-start sm:self-auto"
        >
          + Add House
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {houses.map((h) => (
          <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-800">{h.internalDoorNumber}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  h.status === 'occupied'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {h.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-1">Govt door no: {h.govtDoorNumber}</p>
            {h.status === 'occupied' ? (
              <>
                <p className="text-sm text-slate-700">{h.tenantName}</p>
                <p className="text-xs text-slate-500">{h.tenantPhone}</p>
                <p className="text-xs text-slate-500 mt-1">Rent: ₹{h.rentAmount}</p>
                <button
                  onClick={() => setVacatingHouse(h)}
                  className="mt-3 text-xs text-red-600 font-medium hover:underline"
                >
                  Mark Vacate
                </button>
              </>
            ) : (
              <button
                onClick={() => setBookingHouse(h)}
                className="mt-3 text-xs text-brand font-medium hover:underline"
              >
                Book this house
              </button>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateHouseModal onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}
      {bookingHouse && (
        <BookHouseModal house={bookingHouse} onClose={() => setBookingHouse(null)} onDone={refresh} />
      )}
      {vacatingHouse && (
        <VacateHouseModal house={vacatingHouse} onClose={() => setVacatingHouse(null)} onDone={refresh} />
      )}
    </div>
  )
}

function CreateHouseModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '' })
  async function submit(e) {
    e.preventDefault()
    await createHouse(form)
    onCreated()
    onClose()
  }
  return (
    <Modal title="Add House" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {['govtDoorNumber', 'internalDoorNumber', 'floor', 'ebNumber'].map((field) => (
          <input
            key={field}
            required
            placeholder={field}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        ))}
        <button className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium">Create</button>
      </form>
    </Modal>
  )
}

function BookHouseModal({ house, onClose, onDone }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', rentAmount: '', advanceAmount: '', aadhaarNumber: '',
  })
  const [customerId, setCustomerId] = useState(null)

  async function submit(e) {
    e.preventDefault()
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
    })
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
        <input required type="number" placeholder="Rent amount" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required type="number" placeholder="Advance amount" value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium">Book House</button>
      </form>
    </Modal>
  )
}

function VacateHouseModal({ house, onClose, onDone }) {
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
