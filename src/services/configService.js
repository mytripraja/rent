import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

const configDocRef = doc(db, 'appConfig', 'general')
let appConfigCache = null
let appConfigCacheAt = 0
const APP_CONFIG_CACHE_MS = 10000
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
  let snap
  try {
    snap = await getDoc(configDocRef)
  } catch (err) {
    console.warn('appConfig unreachable, using defaults:', err.message)
    appConfigCache = { ...DEFAULTS }; appConfigCacheAt = Date.now()
    return { ...DEFAULTS }
  }

  if (snap.exists()) {
    const data = snap.data()
    const result = {
      cashReceivers: data.cashReceivers || DEFAULT_RECEIVERS,
      apartmentName: data.apartmentName || DEFAULTS.apartmentName,
      apartmentAddress: data.apartmentAddress || DEFAULTS.apartmentAddress,
      dueDate: data.dueDate || DEFAULTS.dueDate,
      gracePeriod: data.gracePeriod || DEFAULTS.gracePeriod,
      penaltyPerDay: data.penaltyPerDay || DEFAULTS.penaltyPerDay,
      upiId: data.upiId || DEFAULTS.upiId,
      ownerName: data.ownerName || DEFAULTS.ownerName,
      paymentModes: data.paymentModes || DEFAULTS.paymentModes,
      lateFeeType: data.lateFeeType || DEFAULTS.lateFeeType,
      lateFeeAmount: data.lateFeeAmount || DEFAULTS.lateFeeAmount,
      lateFeeGraceDays: data.lateFeeGraceDays || DEFAULTS.lateFeeGraceDays,
      wasteSchedule: data.wasteSchedule || DEFAULTS.wasteSchedule,
      // Keep the multi-apartment list in the cached config. Without this field
      // getProperties() fell back to the default apartment after every read,
      // making newly-created apartments appear to disappear on mobile.
      properties: Array.isArray(data.properties) && data.properties.length
        ? data.properties
        : [{ id: 'default', name: data.apartmentName || DEFAULTS.apartmentName, address: data.apartmentAddress || DEFAULTS.apartmentAddress }],
    }
    appConfigCache = result
    appConfigCacheAt = Date.now()
    return result
  }
  return { ...DEFAULTS }
}

export async function updateAppConfig(fields) {
  appConfigCache = null
  appConfigCacheAt = 0
  await setDoc(configDocRef, { ...fields, updatedAt: Date.now() }, { merge: true })
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

export async function getProperties() {
  const config = await getAppConfig()
  return Array.isArray(config.properties) && config.properties.length
    ? config.properties
    : [{ id: 'default', name: config.apartmentName || 'My Apartment', address: config.apartmentAddress || '' }]
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

const rentReminderRulesRef = collection(db, 'rentReminderRules')
let rentReminderRulesCache = null
let rentReminderRulesCacheAt = 0

export async function getRentReminderRules() {
  if (rentReminderRulesCache && Date.now() - rentReminderRulesCacheAt < 15000) return rentReminderRulesCache
  const snap = await getDocs(rentReminderRulesRef)
  rentReminderRulesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  rentReminderRulesCacheAt = Date.now()
  return rentReminderRulesCache
}

export async function updateRentReminderRules(rules) {
  const { writeBatch } = await import('firebase/firestore')
  const snap = await getDocs(rentReminderRulesRef)
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.delete(d.ref))
  rules.forEach(rule => batch.set(doc(rentReminderRulesRef, rule.id || `rent-${rule.houseId}`), rule))
  await batch.commit()
  rentReminderRulesCache = rules
  rentReminderRulesCacheAt = Date.now()
}
