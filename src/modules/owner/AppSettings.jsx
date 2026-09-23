import { useEffect, useState } from 'react'
import { getCashReceivers, updateCashReceivers, getRentReminderRules, updateRentReminderRules, getActivePropertyId, getProperties, updateProperty } from '../../services/configService'
import { listHouses } from '../../services/houseService'

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
  const [houses, setHouses] = useState([])
  const [reminderRules, setReminderRules] = useState([])
  const [reminderForm, setReminderForm] = useState({ houseId:'', dayOfMonth:5, time:'09:00', enabled:true })
  const [activePropertyId, setActivePropertyIdState] = useState('')
  const [properties, setProperties] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { getAppConfig } = await import('../../services/configService')
      const config = await getAppConfig()
      const props = await getProperties().catch(() => [])
      const currentId = getActivePropertyId() || props[0]?.id || 'default'
      const current = props.find(p => p.id === currentId) || props[0] || { name: config.apartmentName || 'My Apartment', address: config.apartmentAddress || '' }
      setProperties(props)
      setActivePropertyIdState(currentId)
      setReceivers(config.cashReceivers || [])
      setApartmentName(current.name || config.apartmentName || '')
      setApartmentAddress(current.address || config.apartmentAddress || '')
      setLateFeeType(config.lateFeeType || 'flat')
      setLateFeeAmount(config.lateFeeAmount || 500)
      setLateFeeGraceDays(config.lateFeeGraceDays || 5)
      setUpiId(config.upiId || '')
      setOwnerName(config.ownerName || '')
      const loadedHouses = await listHouses(currentId).catch(() => [])
      setHouses(loadedHouses)
      const rules = await getRentReminderRules().catch(() => [])
      setReminderRules(rules.filter(r => !r.propertyId || r.propertyId === currentId))
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
    setSaving(true)
    setError('')
    try {
      await updateProperty(activePropertyId || 'default', { name: apartmentName.trim() || 'My Apartment', address: apartmentAddress.trim() })
      window.dispatchEvent(new CustomEvent('rm:property-changed', { detail: { id: activePropertyId || 'default' } }))
    } catch (err) {
      console.error(err)
      setError('Failed to save apartment details.')
    } finally {
      setSaving(false)
    }
  }

  async function saveReminderRule(e) {
    e.preventDefault()
    if (!reminderForm.houseId) return
    const house = houses.find(h => h.id === reminderForm.houseId)
    const next = [...reminderRules.filter(r => r.houseId !== reminderForm.houseId), { ...reminderForm, id: `rent-${reminderForm.houseId}`, propertyId: house?.propertyId || 'default', dayOfMonth: Math.min(31, Math.max(1, Number(reminderForm.dayOfMonth))), time: reminderForm.time || '09:00', enabled: !!reminderForm.enabled, updatedAt: Date.now() }]
    setReminderRules(next)
    await updateRentReminderRules(next)
  }

  async function removeReminderRule(id) {
    const next = reminderRules.filter(r => r.id !== id)
    setReminderRules(next); await updateRentReminderRules(next)
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
          <p className="text-xs text-ink-soft">Edit the currently selected apartment. Other apartments remain separate.</p>
        </div>
        {properties.length > 1 && <label className="text-xs font-medium text-ink">Apartment<select value={activePropertyId} onChange={e => { const id=e.target.value; const p=properties.find(x=>x.id===id); setActivePropertyIdState(id); setApartmentName(p?.name || ''); setApartmentAddress(p?.address || '') }} className="w-full mt-1">{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        
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

      <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-2xl">
        <div><h3 className="font-medium text-ink">Rent reminder schedule</h3><p className="text-xs text-ink-soft">Set a separate monthly unpaid-rent reminder for each house. The tenant receives it only when the current month's rent is still unpaid.</p></div>
        <form onSubmit={saveReminderRule} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <div><label className="block text-xs font-medium text-ink mb-1">House</label><select value={reminderForm.houseId} onChange={e=>setReminderForm({...reminderForm,houseId:e.target.value})} className="w-full"><option value="">Choose house</option>{houses.filter(h=>h.status==='occupied').map(h=><option key={h.id} value={h.id}>{h.internalDoorNumber} · {h.tenantName || 'Tenant'}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-ink mb-1">Every month, day</label><input type="number" min="1" max="31" value={reminderForm.dayOfMonth} onChange={e=>setReminderForm({...reminderForm,dayOfMonth:e.target.value})} className="w-full"/></div>
          <div><label className="block text-xs font-medium text-ink mb-1">Time (India)</label><input type="time" value={reminderForm.time} onChange={e=>setReminderForm({...reminderForm,time:e.target.value})} className="w-full"/></div>
          <button disabled={saving || !reminderForm.houseId} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">Save reminder</button>
        </form>
        <div className="space-y-2">{reminderRules.map(r=>{const h=houses.find(x=>x.id===r.houseId); return <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brass/10 bg-paper p-3"><div className="flex-1 min-w-48"><p className="text-sm font-semibold text-ink">{h?.internalDoorNumber || r.houseId}</p><p className="text-xs text-ink-soft">Every month on day {r.dayOfMonth} at {r.time} · {h?.tenantName || 'Tenant'}</p></div><button type="button" onClick={()=>setReminderForm({houseId:r.houseId,dayOfMonth:r.dayOfMonth,time:r.time,enabled:r.enabled!==false})} className="text-xs font-semibold text-brand">Edit</button><button type="button" onClick={()=>removeReminderRule(r.id)} className="text-xs text-stamp-red">Remove</button></div>})}{reminderRules.length===0&&<p className="text-xs text-ink-soft">No scheduled rent reminders yet.</p>}</div>
        <p className="text-[11px] text-ink-soft">The scheduler checks every 15 minutes through the existing GitHub Actions job, so the notification may arrive a few minutes after the selected time. No reminder is sent after an approved payment for that month.</p>
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
