import { useEffect, useState } from 'react'
import { getHouse, getHouseHistory } from '../../services/houseService'
import { listRentHistory } from '../../services/rentService'
import { listAdvanceLedger, addAdvancePayment, getAdvanceCollected } from '../../services/advanceLedgerService'
import { updateTenantContact } from '../../services/authService'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'
import { useAuth } from '../../context/AuthContext'

export default function TenantProfile({ houseId, onBack }) {
  const { user } = useAuth()
  const [house, setHouse] = useState(null)
  const [rentHistory, setRentHistory] = useState([])
  const [pastOccupants, setPastOccupants] = useState([])
  const [ledger, setLedger] = useState([])
  const [collected, setCollected] = useState(0)
  const [editingContact, setEditingContact] = useState(false)
  const [addingAdvance, setAddingAdvance] = useState(false)

  useEffect(() => {
    load()
  }, [houseId])

  async function load() {
    const h = await getHouse(houseId)
    setHouse(h)
    setRentHistory(await listRentHistory(houseId))
    setPastOccupants((await getHouseHistory(houseId)).filter((entry) => entry.movedOutAt))
    if (h?.status === 'occupied') {
      setLedger(await listAdvanceLedger(houseId))
      setCollected(await getAdvanceCollected(houseId))
    }
  }

  if (!house) return <p className="text-sm text-ink-soft py-8 text-center" role="status">Loading…</p>

  const isVacant = house.status !== 'occupied'

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={onBack} className="text-sm text-ink-soft hover:text-ink">← Back to Tenants</button>

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-paper overflow-hidden flex items-center justify-center text-lg text-ink-soft shrink-0">
          {house.tenantPhotoUrl ? <img src={house.tenantPhotoUrl} alt="" className="w-full h-full object-cover" /> : (house.tenantName || '?')[0]}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">{house.tenantName || 'Vacant house'}</h2>
          <p className="text-sm text-ink-soft">House {house.internalDoorNumber} {isVacant && '· Currently vacant'}</p>
        </div>
      </div>

      {!isVacant && (
        <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink text-sm">Contact Info</h3>
            <button onClick={() => setEditingContact(true)} className="text-xs text-brand hover:underline">Edit</button>
          </div>
          <p className="text-sm text-ink-soft">Phone: {house.tenantPhone}</p>
          <p className="text-sm text-ink-soft">Email: {house.tenantEmail}</p>
          <p className="text-sm text-ink-soft">Move-in date: {house.moveInDate || '—'}</p>
          <p className="text-sm text-ink-soft">EB Number: {house.ebNumber || '—'}</p>
          <p className="text-sm text-ink-soft">Rent: ₹{house.rentAmount}</p>
        </div>
      )}

      {!isVacant && (
        <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink text-sm">Advance Payment</h3>
            <button onClick={() => setAddingAdvance(true)} className="text-xs text-brand hover:underline">Add Payment</button>
          </div>
          <p className="text-sm text-ink-soft">
            Collected ₹{collected} of ₹{house.advanceAmount} agreed
            {collected < house.advanceAmount && <span className="text-amber-600"> · ₹{house.advanceAmount - collected} remaining</span>}
          </p>
          <div className="space-y-1.5">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex justify-between text-xs text-ink-soft border-b border-brass/15 pb-1">
                <span>{entry.date} · {entry.mode}{entry.note ? ` · ${entry.note}` : ''}</span>
                <span className="font-medium text-ink">₹{entry.amount}</span>
              </div>
            ))}
            {ledger.length === 0 && <p className="text-xs text-ink-soft">No advance payments recorded yet.</p>}
          </div>
        </div>
      )}

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
        <h3 className="font-semibold text-ink text-sm mb-3">Rent History</h3>
        <div className="space-y-1.5">
          {rentHistory.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm border-b border-brass/15 pb-1.5">
              <span className="text-ink-soft">{p.month} · ₹{p.amount}</span>
              <ApprovalStatusBadge status={p.status === 'approved' ? 'paid' : p.status} />
            </div>
          ))}
          {rentHistory.length === 0 && <p className="text-xs text-ink-soft">No rent history yet.</p>}
        </div>
      </div>

      {pastOccupants.length > 0 && (
        <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
          <h3 className="font-semibold text-ink text-sm mb-3">Previous Occupants of This House</h3>
          <div className="space-y-1.5">
            {pastOccupants.map((o) => (
              <div key={o.id} className="text-xs text-ink-soft border-b border-brass/15 pb-1.5">
                {o.name} · {o.moveInDate || '—'} to {new Date(o.movedOutAt).toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task 3 & 7: Notes and Comm Log */}
      <HouseNotes houseId={house.id} />
      {!isVacant && <CommLog houseId={house.id} tenantName={house.tenantName} />}

      {editingContact && (
        <EditContactModal house={house} onClose={() => setEditingContact(false)} onSaved={load} />
      )}
      {addingAdvance && (
        <AddAdvanceModal house={house} user={user} onClose={() => setAddingAdvance(false)} onSaved={load} />
      )}
    </div>
  )
}

function HouseNotes({ houseId }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [houseId])

  async function load() {
    const { listNotes } = await import('../../services/notesService')
    setNotes(await listNotes(houseId))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    const { addNote } = await import('../../services/notesService')
    await addNote(houseId, { text, createdBy: user?.uid, createdByName: user?.name })
    setText('')
    setSaving(false)
    load()
  }

  async function handleDelete(noteId) {
    if (!window.confirm('Delete note?')) return
    const { deleteNote } = await import('../../services/notesService')
    await deleteNote(houseId, noteId)
    load()
  }

  return (
    <div className="bg-[#fffdf2] rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
        <span className="text-amber-500">🔒</span> Private Notes
      </h3>
      <form onSubmit={handleAdd} className="flex gap-2">
        <textarea 
          rows={2} 
          placeholder="Add a private note (owners only)..." 
          value={text} 
          onChange={e => setText(e.target.value)}
          className="flex-1 border border-brass/30 rounded-lg px-3 py-2 text-sm bg-white" 
        />
        <button disabled={saving || !text.trim()} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium h-fit">Add</button>
      </form>
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="bg-white p-3 rounded-lg border border-amber-100 text-sm">
            <p className="text-ink whitespace-pre-wrap">{n.text}</p>
            <div className="flex justify-between mt-2 text-[11px] text-ink-soft">
              <span>By {n.createdByName} · {new Date(n.createdAt).toLocaleDateString()}</span>
              <button onClick={() => handleDelete(n.id)} className="text-red-500 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CommLog({ houseId, tenantName }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState({ type: 'call', date: new Date().toISOString().split('T')[0], summary: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [houseId])

  async function load() {
    const { listCommLogs } = await import('../../services/commLogService')
    setLogs(await listCommLogs(houseId))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.summary.trim()) return
    setSaving(true)
    const { addCommLog } = await import('../../services/commLogService')
    await addCommLog({
      houseId,
      tenantName,
      ...form,
      loggedBy: user?.uid,
      loggedByName: user?.name
    })
    setForm(f => ({ ...f, summary: '' }))
    setSaving(false)
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete log?')) return
    const { deleteCommLog } = await import('../../services/commLogService')
    await deleteCommLog(id)
    load()
  }

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-ink text-sm">Communication Log</h3>
      <form onSubmit={handleAdd} className="space-y-3 bg-paper p-3 rounded-xl border border-brass/10">
        <div className="flex gap-2">
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="border border-brass/30 rounded-lg px-2 py-1 text-sm bg-white">
            <option value="call">Call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="in_person">In Person</option>
          </select>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="border border-brass/30 rounded-lg px-2 py-1 text-sm bg-white" />
        </div>
        <textarea rows={2} placeholder="Summary of conversation..." value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-white" />
        <button disabled={saving || !form.summary.trim()} className="bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-medium">Log Entry</button>
      </form>
      
      <div className="space-y-3">
        {logs.map(l => (
          <div key={l.id} className="text-sm border-l-2 border-brass/40 pl-3 py-1">
            <div className="flex justify-between items-start">
              <span className="font-medium text-ink capitalize">{l.type.replace('_', ' ')} · {l.date}</span>
              <button onClick={() => handleDelete(l.id)} className="text-[10px] text-red-500 hover:underline">Delete</button>
            </div>
            <p className="text-ink-soft mt-1">{l.summary}</p>
            <p className="text-[10px] text-brass mt-1">Logged by {l.loggedByName}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditContactModal({ house, onClose, onSaved }) {
  const [email, setEmail] = useState(house.tenantEmail || '')
  const [phone, setPhone] = useState(house.tenantPhone || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateTenantContact({
        tenantUid: house.currentTenantId,
        houseId: house.id,
        newEmail: email !== house.tenantEmail ? email : undefined,
        newPhone: phone !== house.tenantPhone ? phone : undefined,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-3">
        <h3 className="font-semibold text-ink">Edit Contact Info</h3>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" placeholder="Email" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" placeholder="Phone" />
        {email !== house.tenantEmail && (
          <p className="text-xs text-amber-600">Changing the email also changes their login.</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function AddAdvanceModal({ house, user, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', date: '', mode: 'cash', note: '' })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await addAdvancePayment({
        houseId: house.id,
        tenantId: house.currentTenantId,
        amount: Number(form.amount),
        date: form.date,
        mode: form.mode,
        note: form.note,
        recordedBy: { uid: user.uid, name: user.name },
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-paper-raised rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-3">
        <h3 className="font-semibold text-ink">Add Advance Payment</h3>
        <input required type="number" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank">Bank Transfer</option>
        </select>
        <input placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Add'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-paper border border-brass/30 text-ink-soft py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      </form>
    </div>
  )
}
