import { useEffect, useState } from 'react'
import { getCashReceivers, updateCashReceivers } from '../../services/configService'

export default function AppSettings() {
  const [receivers, setReceivers] = useState([])
  const [newReceiver, setNewReceiver] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await getCashReceivers()
      setReceivers(data)
    } catch (err) {
      console.error(err)
      setError('Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newReceiver.trim()) return
    const updated = [...receivers, newReceiver.trim()]
    setReceivers(updated)
    setNewReceiver('')
    await save(updated)
  }

  async function handleDelete(index) {
    const updated = receivers.filter((_, i) => i !== index)
    setReceivers(updated)
    await save(updated)
  }

  async function save(updatedReceivers) {
    setSaving(true)
    setError('')
    try {
      await updateCashReceivers(updatedReceivers)
    } catch (err) {
      console.error(err)
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-ink-soft">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">App Settings</h2>
        <p className="text-sm text-ink-soft">Configure global app behavior.</p>
      </div>

      {error && <div className="text-sm text-stamp-red">{error}</div>}

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-md">
        <div>
          <h3 className="font-medium text-ink">Cash Receivers</h3>
          <p className="text-xs text-ink-soft">People who can receive cash rent payments.</p>
        </div>
        
        <ul className="space-y-2">
          {receivers.map((r, i) => (
            <li key={i} className="flex justify-between items-center bg-paper rounded-lg p-2 text-sm border border-brass/10">
              <span className="text-ink font-medium">{r}</span>
              <button 
                onClick={() => handleDelete(i)} 
                className="text-stamp-red hover:underline text-xs px-2 py-1"
                disabled={saving}
                type="button"
              >
                Delete
              </button>
            </li>
          ))}
          {receivers.length === 0 && <li className="text-xs text-ink-soft">No receivers defined.</li>}
        </ul>

        <form onSubmit={handleAdd} className="flex gap-2 pt-2">
          <input 
            placeholder="New receiver name..." 
            value={newReceiver}
            onChange={(e) => setNewReceiver(e.target.value)}
            className="flex-1 border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover" 
            disabled={saving}
          />
          <button 
            disabled={saving || !newReceiver.trim()} 
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 shrink-0"
            type="submit"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  )
}
