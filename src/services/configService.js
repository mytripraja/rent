import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const configDocRef = doc(db, 'appConfig', 'general')
const DEFAULT_RECEIVERS = ['Deepu', 'Rajavel', 'Siva', 'Hemalathe']

export async function getAppConfig() {
  const snap = await getDoc(configDocRef)
  if (snap.exists()) {
    return snap.data()
  }
  return { cashReceivers: DEFAULT_RECEIVERS }
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
