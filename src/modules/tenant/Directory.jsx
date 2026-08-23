import { useEffect, useState } from 'react'
import { listDirectory, setPhoneVisibility } from '../../services/houseService'
import { useAuth } from '../../context/AuthContext'

export default function Directory() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [visible, setVisible] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [user])

  async function refresh() {
    const all = await listDirectory()
    setEntries(all)
    const mine = all.find((e) => e.id === user?.houseId)
    if (mine) setVisible(mine.phoneVisibleToNeighbors)
  }

  async function toggleVisibility() {
    setSaving(true)
    try {
      await setPhoneVisibility(user.houseId, !visible)
      setVisible(!visible)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const occupied = entries.filter((e) => e.status === 'occupied')
  const vacant = entries.filter((e) => e.status === 'vacant')

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Directory</h3>
        <p className="text-xs text-ink-soft">{occupied.length} occupied · {vacant.length} vacant</p>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-soft bg-paper rounded-lg p-2.5">
        <input type="checkbox" checked={visible} disabled={saving} onChange={toggleVisibility} />
        Show my phone number to neighbors
      </label>

      <div>
        <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Neighbors</h4>
        <div className="space-y-1.5">
          {occupied.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-b border-brass/15 pb-1.5">
              <span className="text-ink">{e.internalDoorNumber} · {e.tenantName}</span>
              <span className="text-ink-soft text-xs">{e.tenantPhone || 'Hidden'}</span>
            </div>
          ))}
          {occupied.length === 0 && <p className="text-xs text-ink-soft">No occupied houses.</p>}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Vacant Houses</h4>
        <div className="flex flex-wrap gap-2">
          {vacant.map((e) => (
            <span key={e.id} className="text-xs bg-paper text-ink-soft px-3 py-1.5 rounded-full">
              {e.internalDoorNumber}
            </span>
          ))}
          {vacant.length === 0 && <p className="text-xs text-ink-soft">None right now.</p>}
        </div>
      </div>
    </div>
  )
}
