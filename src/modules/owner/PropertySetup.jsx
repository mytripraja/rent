import { useEffect, useState } from 'react'
import { listHouses, createHouse, updateHouse, deleteHouse } from '../../services/houseService'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'
import { uploadUnsigned } from '../../services/cloudinaryService'

export default function PropertySetup() {
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [form, setForm] = useState({ govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '', photos: [] })
  const [saving, setSaving] = useState(false)
  const [editingHouse, setEditingHouse] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setHouses(await listHouses())
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      const urls = []
      for (const file of files) {
        const { url } = await uploadUnsigned(file, 'houses')
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
        await updateHouse(editingHouse.id, form)
        showToast({ message: 'House updated successfully', type: 'success' })
      } else {
        await createHouse(form)
        showToast({ message: 'House added successfully', type: 'success' })
      }
      setForm({ govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '' })
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
    })
  }

  function handleCancelEdit() {
    setEditingHouse(null)
    setForm({ govtDoorNumber: '', internalDoorNumber: '', floor: '', ebNumber: '', photos: [] })
  }

  async function performDelete() {
    if (!deletingId) return
    try {
      await deleteHouse(deletingId)
      showToast({ message: 'House deleted successfully', type: 'success' })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to delete house: ' + err.message, type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Property Setup</h2>
        <p className="text-sm text-ink-soft">
          Add each house once, when you first set up the app. Day-to-day booking and vacating happens under the Houses tab.
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
                  {h.status === 'vacant' && (
                    <button onClick={() => setDeletingId(h.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  )}
                </div>
              </div>
              <p className="text-xs text-ink-soft mt-1">Govt: {h.govtDoorNumber} · Floor {h.floor} · EB {h.ebNumber}</p>
            </div>
          ))}
          {houses.length === 0 && <p className="text-sm text-ink-soft">No houses added yet.</p>}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete House"
        message="Are you sure you want to delete this house? This cannot be undone."
        onConfirm={performDelete}
        onCancel={() => setDeletingId(null)}
        confirmText="Delete"
        danger
      />
    </div>
  )
}
