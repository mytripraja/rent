import { useEffect, useState } from 'react'
import { listHouses, createHouse } from '../../services/houseService'

export default function PropertySetup() {
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState({ govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createHouse(form)
      setForm({ govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '' })
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Property Setup</h2>
        <p className="text-sm text-slate-500">
          Add each house once, when you first set up the app. Day-to-day booking and vacating happens under the Houses tab.
        </p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 max-w-md">
        <input required placeholder="Government door number" value={form.govtDoorNumber}
          onChange={(e) => setForm({ ...form, govtDoorNumber: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="Your internal door number (e.g. F1, 1S)" value={form.internalDoorNumber}
          onChange={(e) => setForm({ ...form, internalDoorNumber: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="Floor" value={form.floor}
          onChange={(e) => setForm({ ...form, floor: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="EB number" value={form.ebNumber}
          onChange={(e) => setForm({ ...form, ebNumber: e.target.value })}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button disabled={saving} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? 'Adding…' : '+ Add House'}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">All Houses ({houses.length})</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl">
          {houses.map((h) => (
            <div key={h.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-sm">
              <p className="font-medium text-slate-700">{h.internalDoorNumber}</p>
              <p className="text-xs text-slate-400">Govt: {h.govtDoorNumber} · Floor {h.floor} · EB {h.ebNumber}</p>
            </div>
          ))}
          {houses.length === 0 && <p className="text-sm text-slate-400">No houses added yet.</p>}
        </div>
      </div>
    </div>
  )
}
