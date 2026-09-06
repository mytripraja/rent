import { useEffect, useState } from 'react'
import { getCashReceivers, updateCashReceivers } from '../../services/configService'

export default function AppSettings() {
  const [receivers, setReceivers] = useState([])
  const [apartmentName, setApartmentName] = useState('')
  const [apartmentAddress, setApartmentAddress] = useState('')
  const [lateFeeType, setLateFeeType] = useState('flat')
  const [lateFeeAmount, setLateFeeAmount] = useState(500)
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState(5)
  const [upiId, setUpiId] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [newReceiver, setNewReceiver] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { getAppConfig } = await import('../../services/configService')
      const config = await getAppConfig()
      setReceivers(config.cashReceivers || [])
      setApartmentName(config.apartmentName || '')
      setApartmentAddress(config.apartmentAddress || '')
      setLateFeeType(config.lateFeeType || 'flat')
      setLateFeeAmount(config.lateFeeAmount || 500)
      setLateFeeGraceDays(config.lateFeeGraceDays || 5)
      setUpiId(config.upiId || '')
      setOwnerName(config.ownerName || '')
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
      const { updateAppConfig } = await import('../../services/configService')
      await updateAppConfig({ 
        cashReceivers: updatedReceivers,
        apartmentName,
        apartmentAddress,
        lateFeeType,
        lateFeeAmount,
        lateFeeGraceDays,
        upiId,
        ownerName
      })
    } catch (err) {
      console.error(err)
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDetails() {
    await save(receivers)
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
          <h3 className="font-medium text-ink">Apartment Details</h3>
          <p className="text-xs text-ink-soft">Used in receipts and reports.</p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Apartment Name</label>
            <input 
              value={apartmentName}
              onChange={(e) => setApartmentName(e.target.value)}
              className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Address</label>
            <textarea 
              value={apartmentAddress}
              onChange={(e) => setApartmentAddress(e.target.value)}
              className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover"
              rows={2}
            />
          </div>
          <button 
            onClick={handleSaveDetails}
            disabled={saving} 
            className="w-full bg-cover text-paper px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            Save Details
          </button>
        </div>
      </div>

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-md">
        <div>
          <h3 className="font-medium text-ink">UPI Settings</h3>
          <p className="text-xs text-ink-soft">Receive payments via UPI deep links.</p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Owner UPI ID</label>
            <input 
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. name@bank"
              className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Payee Name</label>
            <input 
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Name linked to UPI account"
              className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover"
            />
          </div>
          <button 
            onClick={handleSaveDetails}
            disabled={saving} 
            className="w-full bg-cover text-paper px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            Save UPI Details
          </button>
        </div>
      </div>

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-md">
        <div>
          <h3 className="font-medium text-ink">Late Fee Rules</h3>
          <p className="text-xs text-ink-soft">Applied automatically to late rent payments.</p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Fee Type</label>
            <select 
              value={lateFeeType}
              onChange={(e) => setLateFeeType(e.target.value)}
              className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-cover"
            >
              <option value="flat">Flat Amount</option>
              <option value="per_day">Per Day Amount</option>
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink mb-1">Amount (₹)</label>
              <input 
                type="number"
                value={lateFeeAmount}
                onChange={(e) => setLateFeeAmount(Number(e.target.value))}
                className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink mb-1">Grace Period (Days)</label>
              <input 
                type="number"
                value={lateFeeGraceDays}
                onChange={(e) => setLateFeeGraceDays(Number(e.target.value))}
                className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cover"
              />
            </div>
          </div>
          <button 
            onClick={handleSaveDetails}
            disabled={saving} 
            className="w-full bg-cover text-paper px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            Save Rules
          </button>
        </div>
      </div>

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
