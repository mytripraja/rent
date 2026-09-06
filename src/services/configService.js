import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const configDocRef = doc(db, 'appConfig', 'general')
const DEFAULT_RECEIVERS = ['Deepu', 'Rajavel', 'Siva', 'Hemalathe']

export async function getAppConfig() {
  const snap = await getDoc(configDocRef)
  if (snap.exists()) {
    const data = snap.data()
    return {
      cashReceivers: data.cashReceivers || DEFAULT_RECEIVERS,
      apartmentName: data.apartmentName || 'Rental Manager',
      apartmentAddress: data.apartmentAddress || '',
      dueDate: data.dueDate || 5,
      gracePeriod: data.gracePeriod || 3,
      penaltyPerDay: data.penaltyPerDay || 100,
      upiId: data.upiId || '',
      ownerName: data.ownerName || '',
      paymentModes: data.paymentModes || ['upi', 'cash', 'bank_transfer'],
      lateFeeType: data.lateFeeType || 'flat',
      lateFeeAmount: data.lateFeeAmount || 500,
      lateFeeGraceDays: data.lateFeeGraceDays || 5,
      wasteSchedule: data.wasteSchedule || {
        monday: 'dry',
        tuesday: 'wet',
        wednesday: 'mixed',
        thursday: 'none',
        friday: 'dry',
        saturday: 'wet',
        sunday: 'none'
      }
    }
  }
  return { 
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
}

export async function updateAppConfig(fields) {
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
  return config.properties || [{ id: 'default', name: config.apartmentName || 'My Apartment', address: config.apartmentAddress || '' }]
}

export async function addProperty(property) {
  const props = await getProperties()
  props.push(property)
  await updateAppConfig({ properties: props })
}

export async function updateProperty(id, fields) {
  const props = await getProperties()
  const idx = props.findIndex(p => p.id === id)
  if (idx !== -1) {
    props[idx] = { ...props[idx], ...fields }
    await updateAppConfig({ properties: props })
  }
}

export function getActivePropertyId() {
  return localStorage.getItem('activePropertyId')
}

export function setActivePropertyId(id) {
  localStorage.setItem('activePropertyId', id)
}
