import { useEffect, useState } from 'react'
import { listDirectory, setPhoneVisibility } from '../../services/houseService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

export default function Directory() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [entries, setEntries] = useState([])
  const [visible, setVisible] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
  }, [user])

  async function refresh() {
    try {
      const all = await listDirectory()
      setEntries(all)
      const mine = all.find((e) => e.id === user?.houseId)
      if (mine) setVisible(mine.phoneVisibleToNeighbors)
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load directory", type: "error" })
    }
  }

  async function toggleVisibility() {
    setSaving(true)
    try {
      await setPhoneVisibility(user.houseId, !visible)
      setVisible(!visible)
      showToast({ message: "Visibility updated successfully", type: "success" })
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to update visibility", type: "error" })
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
        <h4 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">Vacant Houses</h4>
        <div className="space-y-4">
          {vacant.map((e) => (
            <div key={e.id} className="bg-paper border border-brass/20 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h5 className="font-semibold text-ink text-sm">House {e.internalDoorNumber}</h5>
                  <p className="text-xs text-ink-soft">
                    {e.govtDoorNumber && `Govt: ${e.govtDoorNumber} · `}Floor {e.floor || 'N/A'}
                  </p>
                </div>
                {e.rentAmount != null && e.rentAmount > 0 && (
                  <div className="bg-stamp-green/10 px-2 py-1 rounded text-xs font-medium text-stamp-green">
                    ₹{e.rentAmount.toLocaleString()}/mo
                  </div>
                )}
              </div>
              
              {e.photos && e.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto mt-3 pb-1 snap-x">
                  {e.photos.map((url, i) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt={`House ${e.internalDoorNumber} view ${i + 1}`} 
                      className="w-32 h-24 object-cover rounded-lg border border-brass/20 shrink-0 snap-center"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {vacant.length === 0 && <p className="text-xs text-ink-soft">None right now.</p>}
        </div>
      </div>
    </div>
  )
}
