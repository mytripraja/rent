import { useEffect, useState } from 'react'
import { listHouses, createHouse, updateHouse } from '../../services/houseService'
import { useToast } from '../shared/ui/Toast'
import { uploadSigned } from '../../services/cloudinaryService'
import { getActivePropertyId, getProperties } from '../../services/configService'

const EMPTY_FORM = { govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '', photos: [], roomCounts: { bedrooms: 0, halls: 1, kitchens: 1, bathrooms: 1, dressingRooms: 0 } }

export default function PropertySetup() {
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingHouse, setEditingHouse] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [activeProperty, setActiveProperty] = useState(null)

  useEffect(() => {
    refresh()
    getProperties().then(list => { const id = getActivePropertyId() || 'default'; setActiveProperty(list.find(p => p.id === id) || list[0] || null) }).catch(() => {})
  }, [])

  async function refresh() {
    try {
      setHouses(await listHouses())
    } catch (err) {
      console.error(err)
      showToast({ message: 'Could not load houses: ' + (err.message || 'Unknown error'), type: 'error' })
    }
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      const urls = []
      for (const file of files) {
        const { url } = await uploadSigned(file, 'houses', { visibility: 'upload' })
        urls.push(url)
      }
      setForm((prev) => ({ ...prev, photos: [...(prev.photos || []), ...urls] }))
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(index) {
    setForm((prev) => {
      const newPhotos = [...(prev.photos || [])]
      newPhotos.splice(index, 1)
      return { ...prev, photos: newPhotos }
    })
  }

  async function submit(e) {
    e.preventDefault()
    const duplicate = houses.find((h) => h.internalDoorNumber.toLowerCase() === form.internalDoorNumber.toLowerCase() && (!editingHouse || h.id !== editingHouse.id))
    if (duplicate) {
      showToast({ message: `House with internal door number ${form.internalDoorNumber} already exists.`, type: 'error' })
      return
    }

    setSaving(true)
    try {
      if (editingHouse) {
        await updateHouse(editingHouse.id, { ...form, propertyId: editingHouse.propertyId || getActivePropertyId() || 'default' })
        showToast({ message: 'House updated successfully', type: 'success' })
      } else {
        await createHouse({ ...form, propertyId: getActivePropertyId() || 'default' })
        showToast({ message: 'House added successfully', type: 'success' })
      }
      setForm({ ...EMPTY_FORM, photos: [], roomCounts: { ...EMPTY_FORM.roomCounts } })
      setEditingHouse(null)
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to save house: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(house) {
    setEditingHouse(house)
    setForm({
      govtDoorNumber: house.govtDoorNumber,
      internalDoorNumber: house.internalDoorNumber,
      floor: house.floor,
      ebNumber: house.ebNumber,
      photos: house.photos || [],
      roomCounts: { bedrooms: 0, halls: 1, kitchens: 1, bathrooms: 1, dressingRooms: 0, ...(house.roomCounts || {}) },
    })
  }

  function handleCancelEdit() {
    setEditingHouse(null)
    setForm({ ...EMPTY_FORM, photos: [], roomCounts: { ...EMPTY_FORM.roomCounts } })
  }


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Property Setup</h2>
        <p className="text-sm text-ink-soft">
          Add each house once, when you first set up the app. Day-to-day booking and vacating happens under the Houses tab. Existing houses are kept safely; use Edit to correct their details.
        </p>
      </div>

      <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3 max-w-md">
        <input required placeholder="Government door number" value={form.govtDoorNumber}
          onChange={(e) => setForm({ ...form, govtDoorNumber: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="Your internal door number (e.g. F1, 1S)" value={form.internalDoorNumber}
          onChange={(e) => setForm({ ...form, internalDoorNumber: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="Floor" value={form.floor}
          onChange={(e) => setForm({ ...form, floor: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="EB number" value={form.ebNumber}
          onChange={(e) => setForm({ ...form, ebNumber: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-3 space-y-3">
          <div><p className="text-sm font-bold text-ink">House room layout</p><p className="text-xs text-ink-soft mt-0.5">Save the physical room count once. You can edit it later.</p></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[['bedrooms','Bedrooms'],['halls','Hall'],['kitchens','Kitchen'],['bathrooms','Bathroom'],['dressingRooms','Dressing room']].map(([key,label]) => (
              <label key={key} className="text-xs font-semibold text-ink-soft">{label}
                <input type="number" min="0" max="30" value={form.roomCounts?.[key] ?? 0}
                  onChange={e => setForm(prev => ({ ...prev, roomCounts: { ...prev.roomCounts, [key]: e.target.value } }))}
                  onWheel={e => e.currentTarget.blur()} className="mt-1 w-full border border-brass/30 rounded-lg px-3 py-2 text-sm text-ink" />
              </label>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">House Photos (optional)</label>
          <input type="file" multiple accept="image/*" onChange={handleFileChange} disabled={uploading || saving}
            className="w-full text-sm text-ink-soft file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20" />
          {uploading && <p className="text-xs text-brand">Uploading photos...</p>}
          {form.photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-2">
              {form.photos.map((url, i) => (
                <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-brass/20 group">
                  <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)}
                    className="absolute inset-0 bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button disabled={saving || uploading} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          {saving ? (editingHouse ? 'Saving…' : 'Adding…') : (editingHouse ? 'Update House' : '+ Add House')}
        </button>
        {editingHouse && (
          <button type="button" onClick={handleCancelEdit} disabled={saving || uploading} className="w-full bg-paper-raised text-ink-soft border border-brass/30 py-2 rounded-lg text-sm font-medium mt-2">
            Cancel Edit
          </button>
        )}
      </form>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-2">All Houses ({houses.length})</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl">
          {houses.map((h) => (
            <div key={h.id} className="bg-paper-raised rounded-xl border border-brass/20 shadow-sm p-3 text-sm">
              <div className="flex justify-between items-start">
                <p className="font-medium text-ink">{h.internalDoorNumber}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(h)} className="text-xs text-brand hover:underline">Edit</button>

                </div>
              </div>
              <p className="text-xs text-ink-soft mt-1">Govt: {h.govtDoorNumber} · Floor {h.floor} · EB {h.ebNumber}</p>
            </div>
          ))}
          {houses.length === 0 && <p className="text-sm text-ink-soft">No houses added yet.</p>}
        </div>
      </div>

    </div>
  )
}
