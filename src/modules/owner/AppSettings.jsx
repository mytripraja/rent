import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getCashReceivers, updateCashReceivers, getRentReminderRules, updateRentReminderRules, getActivePropertyId, getProperties, updateProperty } from '../../services/configService'
import { listHouses } from '../../services/houseService'
import { sensitiveKeyAction } from '../../services/authService'
import { getDeviceSecurity, supportsPlatformAuthenticator, registerDeviceBiometric, disableDeviceSecurity } from '../../services/deviceSecurityService'

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
  const [criticalKey, setCriticalKey] = useState('')
  const [criticalKeyAgain, setCriticalKeyAgain] = useState('')
  const [criticalConfigured, setCriticalConfigured] = useState(false)
  const [securityMessage, setSecurityMessage] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetKey, setResetKey] = useState('')
  const [resetKeyAgain, setResetKeyAgain] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [securityActionBusy, setSecurityActionBusy] = useState(false)
  const [deviceSecurity, setDeviceSecurity] = useState({ enabled:false, method:null })
  const { user } = useAuth()
  const isScopedOwner = user?.role === 'owner' && Array.isArray(user?.propertyAccess) && !user.propertyAccess.includes('*')

  useEffect(() => {
    load()
  }, [user?.uid, JSON.stringify(user?.propertyAccess)])

  async function load() {
    try {
      const { getAppConfig } = await import('../../services/configService')
      const config = await getAppConfig()
      const security = await sensitiveKeyAction('status').catch(() => ({ configured:false }))
      setCriticalConfigured(!!security.configured)
      setDeviceSecurity(getDeviceSecurity(user?.uid))
      const props = await getProperties().catch(() => [])
      const storedId = getActivePropertyId()
      const currentId = (storedId && props.some(p => p.id === storedId)) ? storedId : (props[0]?.id || 'default')
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

  async function handleSaveGlobal() {
    setSaving(true)
    setError('')
    try {
      const { updateAppConfig } = await import('../../services/configService')
      await updateAppConfig({
        cashReceivers: receivers,
        lateFeeType,
        lateFeeAmount: Math.max(0, Number(lateFeeAmount) || 0),
        lateFeeGraceDays: Math.max(0, Number(lateFeeGraceDays) || 0),
        upiId: upiId.trim(),
        ownerName: ownerName.trim()
      })
    } catch (err) {
      console.error(err)
      setError('Failed to save global settings.')
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


  async function saveCriticalKey() {
    setSecurityMessage('')
    if (criticalKey.length < 8) return setSecurityMessage('Use at least 8 characters.')
    if (criticalKey !== criticalKeyAgain) return setSecurityMessage('The passwords do not match.')
    try { await sensitiveKeyAction('set', { key: criticalKey }); setCriticalConfigured(true); setCriticalKey(''); setCriticalKeyAgain(''); setSecurityMessage('Critical change password saved.'); }
    catch (e) { setSecurityMessage(e.message || 'Could not save the critical change password.') }
  }

  async function resetCriticalKey() {
    if (securityActionBusy) return
    setSecurityMessage(''); setSecurityActionBusy(true)
    try { await sensitiveKeyAction('reset-request'); setResetMode(true); setResetCode(''); setSecurityMessage('A reset code was sent to your account email. It expires in 10 minutes.') }
    catch (e) { setSecurityMessage(e.message || 'Could not send the reset email.') }
    finally { setSecurityActionBusy(false) }
  }

  async function confirmCriticalReset() {
    if (securityActionBusy) return
    setSecurityMessage('')
    if (!/^\d{6}$/.test(resetCode) || resetKey.length < 8 || resetKey !== resetKeyAgain) return setSecurityMessage('Enter the 6-digit email code and matching password (at least 8 characters).')
    setSecurityActionBusy(true)
    try { await sensitiveKeyAction('reset-confirm', { code: resetCode, key: resetKey }); setCriticalConfigured(true); setResetCode(''); setResetKey(''); setResetKeyAgain(''); setResetMode(false); setSecurityMessage('Critical change password reset successfully.') }
    catch (e) { setSecurityMessage(e.message || 'Could not reset the critical change password.') }
    finally { setSecurityActionBusy(false) }
  }

  async function enableBiometric() {
    try { const id = await registerDeviceBiometric(user.uid, user.name || user.email || 'Rental Manager user'); const next = getDeviceSecurity(user.uid); setDeviceSecurity(next); setSecurityMessage(`Device face/fingerprint verification enabled (${id.slice(0, 8)}…).`) }
    catch (e) { setSecurityMessage(e.message || 'Device biometric setup failed.') }
  }

  function disableBiometric() { disableDeviceSecurity(user.uid); setDeviceSecurity(getDeviceSecurity(user.uid)); setSecurityMessage('Device verification disabled on this device.') }

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

      {!isScopedOwner && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-md">
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
            onClick={handleSaveGlobal}
            disabled={saving} 
            className="w-full bg-cover text-paper px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            Save UPI Details
          </button>
        </div>
      </div>}

      {!isScopedOwner && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-md">
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
            onClick={handleSaveGlobal}
            disabled={saving} 
            className="w-full bg-cover text-paper px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            Save Rules
          </button>
        </div>
      </div>}


      <div className="bg-paper-raised rounded-2xl border border-amber-200 shadow-sm p-4 space-y-4 max-w-2xl">
        <div><h3 className="font-medium text-ink">Critical change security</h3><p className="text-xs text-ink-soft mt-1">Correcting an approved rent record is deliberately hidden behind a separate password. This password is never stored in the browser or Firestore as plain text.</p></div>
        {!criticalConfigured && <div className="grid sm:grid-cols-2 gap-3"><input type="password" minLength="8" value={criticalKey} onChange={e=>setCriticalKey(e.target.value)} placeholder="New critical change password" autoComplete="new-password"/><input type="password" minLength="8" value={criticalKeyAgain} onChange={e=>setCriticalKeyAgain(e.target.value)} placeholder="Repeat password" autoComplete="new-password"/></div>}
        <div className="flex flex-wrap gap-2">{!criticalConfigured && <button type="button" onClick={saveCriticalKey} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-bold">Set password</button>}<button type="button" onClick={resetCriticalKey} disabled={securityActionBusy} className="rm-secondary-button px-4 py-2 text-sm disabled:opacity-50">{criticalConfigured?'Change password by email reset':'Forgot password / email reset'}</button></div>
        {resetMode && <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 space-y-2"><p className="text-xs font-bold text-ink">Email reset code</p><input value={resetCode} onChange={e=>setResetCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" placeholder="6-digit code" autoComplete="one-time-code"/><div className="grid sm:grid-cols-2 gap-2"><input type="password" minLength="8" value={resetKey} onChange={e=>setResetKey(e.target.value)} placeholder="New critical password" autoComplete="new-password"/><input type="password" minLength="8" value={resetKeyAgain} onChange={e=>setResetKeyAgain(e.target.value)} placeholder="Repeat password" autoComplete="new-password"/></div><button type="button" onClick={confirmCriticalReset} disabled={securityActionBusy || !/^\d{6}$/.test(resetCode) || resetKey.length < 8 || resetKey !== resetKeyAgain} className="bg-brand text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50">{securityActionBusy ? 'Please wait…' : 'Confirm reset'}</button></div>}
        <div className="rounded-xl bg-paper border border-[var(--rm-border)] p-3"><p className="text-xs font-semibold text-ink">Device face / fingerprint verification</p><p className="text-[11px] text-ink-soft mt-1">Uses your browser/device passkey (Face ID, Windows Hello or fingerprint when supported). The biometric itself is not sent to Rental Manager.</p><div className="mt-2 flex flex-wrap gap-2">{supportsPlatformAuthenticator() && deviceSecurity.method==='biometric' ? <button type="button" onClick={disableBiometric} className="rm-secondary-button px-3 py-2 text-xs">Disable on this device</button> : <button type="button" disabled={!supportsPlatformAuthenticator()} onClick={enableBiometric} className="bg-brand text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50">Enable Face / Fingerprint</button>}</div></div>
        {securityMessage && <p className="text-xs text-brand" role="status">{securityMessage}</p>}
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

      {!isScopedOwner && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-4 max-w-md">
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
      </div>}
    </div>
  )
}
