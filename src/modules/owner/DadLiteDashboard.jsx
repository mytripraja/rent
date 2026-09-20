import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleDollarSign, LogOut, RotateCcw, Send, UserRound, X } from 'lucide-react'
import { currentMonthStr } from '../../services/rentService'
import { authedFetch } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../services/authService'
import { useToast } from '../shared/ui/Toast'

const RECEIVERS = ['Deepu', 'Rajavel', 'Dada', 'Siva', 'Brother', 'Others']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthLabel(month) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(year, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DadLiteDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [payments, setPayments] = useState([])
  const [month, setMonth] = useState(currentMonthStr())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ amount: '', dateSent: todayStr(), receiver: 'Rajavel', otherReceiver: '' })
  const [saving, setSaving] = useState(false)

  async function load({ quiet = false } = {}) {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await authedFetch('/api/dad-lite', { action: 'roster', month })
      setHouses(data.houses || [])
      setPayments(data.payments || [])
    } catch (err) {
      console.error('Dad Lite roster load failed:', err)
      const message = err?.message || 'Could not load the rent list'
      showToast({ message: message.length > 110 ? `${message.slice(0, 107)}…` : message, type: 'error' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [month])

  const paymentByHouse = useMemo(() => {
    const map = {}
    payments.forEach(p => {
      const existing = map[p.houseId]
      // Prefer approved, then waiting, then the newest rejected/other entry.
      const score = p.status === 'approved' ? 3 : p.status === 'waiting_approval' ? 2 : 1
      const existingScore = existing ? (existing.status === 'approved' ? 3 : existing.status === 'waiting_approval' ? 2 : 1) : 0
      if (!existing || score > existingScore || (score === existingScore && Number(p.submittedAt || 0) > Number(existing.submittedAt || 0))) {
        map[p.houseId] = p
      }
    })
    return map
  }, [payments])

  const counts = useMemo(() => {
    let paid = 0
    let waiting = 0
    let due = 0
    houses.forEach(h => {
      const p = paymentByHouse[h.id]
      if (p?.status === 'approved') paid++
      else if (p?.status === 'waiting_approval') waiting++
      else due++
    })
    return { paid, waiting, due }
  }, [houses, paymentByHouse])

  function openPayment(house) {
    setSelected(house)
    setForm({
      amount: house.rentAmount || '',
      dateSent: todayStr(),
      receiver: 'Rajavel',
      otherReceiver: '',
    })
  }

  function closePayment() {
    if (saving) return
    setSelected(null)
  }

  async function submit(e) {
    e.preventDefault()
    if (!selected) return
    const receiver = form.receiver === 'Others' ? form.otherReceiver.trim() : form.receiver
    if (!receiver) {
      showToast({ message: 'Enter who received the rent', type: 'error' })
      return
    }
    if (!form.dateSent) {
      showToast({ message: 'Select the payment date', type: 'error' })
      return
    }

    setSaving(true)
    try {
      await authedFetch('/api/dad-lite', { action: 'submit-rent',
        houseId: selected.id,
        month,
        dateSent: form.dateSent,
        cashReceivedBy: receiver,
        otherReceiver: form.otherReceiver,
      })
      showToast({ message: `${selected.tenantName || 'Tenant'} rent sent to Deepu for approval`, type: 'success' })
      setSelected(null)
      await load({ quiet: true })
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || 'Could not submit rent', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen -m-4 sm:-m-6 lg:-m-8 bg-[#f6f7f4] text-ink">
      <header className="sticky top-0 z-40 bg-ink text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[.16em] text-white/55">Rental Manager</p>
            <h1 className="text-xl font-extrabold truncate">Rent Collection</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load({ quiet: true })} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Refresh">
              <RotateCcw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={logout} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Log out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 pb-10">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <UserRound size={21} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-ink-soft">Welcome</p>
              <p className="font-bold truncate">{user?.name || 'Rent collection'}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-green-50 px-3 py-2.5"><p className="text-[11px] text-green-700">Paid</p><p className="text-xl font-extrabold text-green-800">{counts.paid}</p></div>
            <div className="rounded-xl bg-amber-50 px-3 py-2.5"><p className="text-[11px] text-amber-700">Waiting</p><p className="text-xl font-extrabold text-amber-800">{counts.waiting}</p></div>
            <div className="rounded-xl bg-slate-100 px-3 py-2.5"><p className="text-[11px] text-slate-600">Not marked</p><p className="text-xl font-extrabold text-slate-800">{counts.due}</p></div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="w-10 h-10 rounded-xl bg-white border border-black/5 shadow-sm flex items-center justify-center" aria-label="Previous month"><ChevronLeft size={19} /></button>
          <div className="text-center">
            <p className="text-xs text-ink-soft">Rent for</p>
            <p className="font-bold">{monthLabel(month)}</p>
          </div>
          <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="w-10 h-10 rounded-xl bg-white border border-black/5 shadow-sm flex items-center justify-center" aria-label="Next month"><ChevronRight size={19} /></button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-ink-soft">Loading tenants…</div>
        ) : houses.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-ink-soft">No occupied houses found.</div>
        ) : (
          <div className="space-y-2.5">
            {houses.map(house => {
              const payment = paymentByHouse[house.id]
              const approved = payment?.status === 'approved'
              const waiting = payment?.status === 'waiting_approval'
              return (
                <div key={house.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-extrabold text-slate-700 shrink-0">
                      {house.internalDoorNumber || '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{house.tenantName || 'Tenant'}</p>
                      <p className="text-xs text-ink-soft">House {house.internalDoorNumber || house.govtDoorNumber || '—'} · ₹{Number(house.rentAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                    {approved && <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-full"><Check size={14} /> Paid</span>}
                    {waiting && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-full">Waiting</span>}
                  </div>

                  {approved ? (
                    <div className="mt-3 rounded-xl bg-green-50/70 px-3 py-2.5 text-xs text-green-800">
                      Paid on {payment.dateSent || '—'} · Received by {payment.cashReceivedBy || '—'}
                    </div>
                  ) : waiting ? (
                    <div className="mt-3 rounded-xl bg-amber-50/70 px-3 py-2.5 text-xs text-amber-800">
                      Submitted on {payment.dateSent || '—'} · Waiting for Deepu to verify and approve.
                    </div>
                  ) : (
                    <button onClick={() => openPayment(house)} className="mt-3 w-full min-h-12 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2 active:scale-[.99] transition">
                      <CircleDollarSign size={19} /> Paid Rent
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 pb-7">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-xs text-ink-soft">Mark rent as received</p>
                <h2 className="text-xl font-extrabold mt-0.5">{selected.tenantName || 'Tenant'}</h2>
                <p className="text-xs text-ink-soft mt-1">House {selected.internalDoorNumber} · {monthLabel(month)}</p>
              </div>
              <button onClick={closePayment} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center" aria-label="Close"><X size={18} /></button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">Rent amount</span>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">₹</span>
                  <input type="text" readOnly value={`₹${Number(form.amount || 0).toLocaleString('en-IN')}`} className="w-full rounded-xl border border-black/10 bg-slate-50 px-3 pl-8 py-3 text-base font-semibold outline-none" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">When was it paid?</span>
                <input type="date" required value={form.dateSent} onChange={e => setForm({ ...form, dateSent: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-slate-50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand/20" />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-ink-soft">Paid to</span>
                <select value={form.receiver} onChange={e => setForm({ ...form, receiver: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-slate-50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand/20">
                  {RECEIVERS.map(name => <option key={name}>{name}</option>)}
                </select>
              </label>

              {form.receiver === 'Others' && (
                <input autoFocus required placeholder="Enter person's name" value={form.otherReceiver} onChange={e => setForm({ ...form, otherReceiver: e.target.value })} className="w-full rounded-xl border border-black/10 bg-slate-50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand/20" />
              )}

              <div className="rounded-xl bg-slate-50 border border-black/5 px-3 py-2.5 text-xs text-ink-soft">
                This entry will go to <strong className="text-ink">Deepu</strong> for verification. It will not be counted as paid until it is approved.
              </div>

              <button disabled={saving} className="w-full min-h-12 rounded-xl bg-brand text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                <Send size={18} /> {saving ? 'Submitting…' : 'Submit for approval'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
