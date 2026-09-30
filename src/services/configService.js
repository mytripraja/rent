import { authedFetch } from './firebase'
let appConfigCache = null
let appConfigCacheAt = 0
const APP_CONFIG_CACHE_MS = 120000
const DEFAULT_RECEIVERS = ['Deepu', 'Rajavel', 'Siva', 'Hemalathe']

const DEFAULTS = {
  cashReceivers: DEFAULT_RECEIVERS,
  apartmentName: 'Rental Manager',
  apartmentAddress: '',
  dueDate: 5,
  gracePeriod: 3,
  penaltyPerDay: 100,
  upiId: '',
  ownerName: '',
  paymentModes: ['upi', 'cash', 'bank_transfer'],
  lateFeeType: 'flat',
  lateFeeAmount: 500,
  lateFeeGraceDays: 5,
  wasteSchedule: {
    monday: 'dry',
    tuesday: 'wet',
    wednesday: 'mixed',
    thursday: 'none',
    friday: 'dry',
    saturday: 'wet',
    sunday: 'none'
  }
}

export async function getAppConfig() {
  if (appConfigCache && Date.now() - appConfigCacheAt < APP_CONFIG_CACHE_MS) return { ...appConfigCache, wasteSchedule: appConfigCache.wasteSchedule ? { ...appConfigCache.wasteSchedule } : appConfigCache.wasteSchedule }
  // Every cashReceivers/templates/properties/wasteSchedule lookup in the app
  // funnels through this one function, so a single network hiccup here used
  // to break all of them at once (the Firestore read had no error handling —
  // a rejected getDoc() propagated up and left every dependent dropdown/list
  // empty for the rest of the session, cash payment included). Falling back
  // to sane defaults here fixes it everywhere in one place instead of
  // patching six separate .catch() handlers with six different fallbacks.
  try {
    const result = await authedFetch('/api/app-config', {})
    appConfigCache = result
    appConfigCacheAt = Date.now()
    return result
  } catch (err) {
    console.warn('appConfig unreachable, using defaults:', err.message)
    // Never replace a previously loaded apartment registry with a default on a transient failure.
    if (appConfigCache) return { ...appConfigCache }
    appConfigCacheAt = 0
    return { ...DEFAULTS }
  }
}

export async function updateAppConfig(fields) {
  appConfigCache = null
  appConfigCacheAt = 0
  propertyRegistryRecoveryDone = false
  propertyRegistryRecoveryPromise = null
  const result = await authedFetch('/api/app-config', { action: 'update', fields })
  appConfigCache = result
  appConfigCacheAt = Date.now()
  return result
}

export async function getCashReceivers() {
  const config = await getAppConfig()
  return config.cashReceivers || DEFAULT_RECEIVERS
}

export async function updateCashReceivers(receivers) {
  await updateAppConfig({ cashReceivers: receivers })
}

const DEFAULT_TEMPLATES = [
  { id: 't1', title: 'Water will be stopped', body: 'Water supply will be stopped today from 10 AM to 2 PM for motor maintenance.' },
  { id: 't2', title: 'EB maintenance scheduled', body: 'EB power cut scheduled tomorrow from 9 AM to 5 PM.' },
  { id: 't3', title: 'Rent reminder', body: 'Friendly reminder that rent is due by the 5th of this month. Please pay to avoid late fees.' },
  { id: 't4', title: 'Common area cleaning', body: 'Common area cleaning will take place tomorrow. Please keep the corridors clear.' }
]

export async function getTemplates() {
  const config = await getAppConfig()
  return config.messageTemplates || DEFAULT_TEMPLATES
}

export async function updateTemplates(templates) {
  await updateAppConfig({ messageTemplates: templates })
}

let propertyRegistryRecoveryDone = false
let propertyRegistryRecoveryPromise = null

export async function getProperties({ recoverLegacy = true } = {}) {
  // Reuse the already-loaded config for two minutes. Property changes call
  // updateAppConfig(), which clears this cache immediately, so freshness is
  // preserved without making every screen pay the network round-trip.
  const config = await getAppConfig()
  const base = Array.isArray(config.properties) && config.properties.length
    ? config.properties.map(p => ({ ...p, id: String(p.id || 'default') }))
    : [{ id: 'default', name: config.apartmentName || 'My Apartment', address: config.apartmentAddress || '' }]

  // Legacy recovery is expensive because it may inspect owner house data. Run it
  // once per app session unless a property/config change explicitly resets it.
  if (!recoverLegacy || propertyRegistryRecoveryDone) return base
  if (propertyRegistryRecoveryPromise) return propertyRegistryRecoveryPromise
  propertyRegistryRecoveryPromise = (async () => {
    try {
      const { auth } = await import('./firebase')
      if (!auth.currentUser) return base
      const result = await authedFetch('/api/owner-houses', {})
      const known = new Set(base.map(p => String(p.id || 'default')))
      const recovered = []
      for (const house of (result.houses || [])) {
        const id = String(house.propertyId || 'default')
        if (id !== 'default' && !known.has(id)) {
          known.add(id)
          recovered.push({ id, name: `Recovered Apartment (${id})`, address: '', recoveredAt: Date.now() })
        }
      }
      propertyRegistryRecoveryDone = true
      if (!recovered.length) return base
      const next = [...base, ...recovered]
      try { await updateAppConfig({ properties: next }) } catch {}
      propertyRegistryRecoveryDone = true
      return next
    } catch (err) {
      propertyRegistryRecoveryDone = true
      console.warn('Legacy property discovery skipped:', err?.message || err)
      return base
    } finally {
      propertyRegistryRecoveryPromise = null
    }
  })()
  return propertyRegistryRecoveryPromise
}

export async function addProperty(property) {
  const props = await getProperties()
  if (props.some(p => p.id === property.id)) throw new Error('Apartment ID already exists.')
  const next = [...props, { ...property, createdAt: property.createdAt || Date.now() }]
  await updateAppConfig({ properties: next })
  // Keep the in-memory config coherent immediately so the header, More page
  // and Apartment Operations all see the new apartment without another read.
  appConfigCache = { ...(appConfigCache || DEFAULTS), properties: next }
  appConfigCacheAt = Date.now()
  return next[next.length - 1]
}

export async function updateProperty(id, fields) {
  const props = await getProperties()
  const idx = props.findIndex(p => p.id === id)
  if (idx !== -1) {
    const next = props.map((item, i) => i === idx ? { ...item, ...fields } : item)
    await updateAppConfig({ properties: next })
    appConfigCache = { ...(appConfigCache || DEFAULTS), properties: next }
    appConfigCacheAt = Date.now()
  }
}

export function getActivePropertyId() {
  return localStorage.getItem('activePropertyId')
}

export function setActivePropertyId(id) {
  localStorage.setItem('activePropertyId', id)
}

let rentReminderRulesCache = null
let rentReminderRulesCacheAt = 0

export async function getRentReminderRules() {
  if (rentReminderRulesCache && Date.now() - rentReminderRulesCacheAt < 15000) return rentReminderRulesCache
  const rows = await authedFetch('/api/app-config', { action: 'reminder-list' })
  rentReminderRulesCache = Array.isArray(rows) ? rows : []
  rentReminderRulesCacheAt = Date.now()
  return rentReminderRulesCache
}

export async function updateRentReminderRules(rules) {
  const rows = await authedFetch('/api/app-config', { action: 'reminder-update', rules })
  rentReminderRulesCache = Array.isArray(rows) ? rows : []
  rentReminderRulesCacheAt = Date.now()
  return rentReminderRulesCache
}
