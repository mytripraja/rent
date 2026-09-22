const KEY_PREFIX = 'rm_device_security_v1_'
const UNLOCK_PREFIX = 'rm_device_unlocked_v1_'

function key(uid) { return `${KEY_PREFIX}${uid}` }
function unlockKey(uid) { return `${UNLOCK_PREFIX}${uid}` }

export function getDeviceSecurity(uid) {
  if (!uid) return { enabled: false, method: null, credentialId: null }
  try { return { enabled:false, method:null, credentialId:null, ...JSON.parse(localStorage.getItem(key(uid)) || '{}') } } catch { return { enabled:false, method:null, credentialId:null } }
}

export function setDeviceSecurity(uid, value) {
  if (!uid) return
  localStorage.setItem(key(uid), JSON.stringify(value))
}

export function clearDeviceUnlock(uid) {
  if (uid) sessionStorage.removeItem(unlockKey(uid))
}

export function markDeviceUnlocked(uid) {
  if (uid) sessionStorage.setItem(unlockKey(uid), '1')
}

export function isDeviceUnlocked(uid) {
  return !!uid && sessionStorage.getItem(unlockKey(uid)) === '1'
}

export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('')
}

function randomBytes(size = 32) {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes
}

function base64Url(bytes) {
  let s = ''
  bytes.forEach(b => { s += String.fromCharCode(b) })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function supportsPlatformAuthenticator() {
  return !!(window.PublicKeyCredential && navigator.credentials?.create && navigator.credentials?.get)
}

export async function registerDeviceBiometric(uid, displayName) {
  if (!supportsPlatformAuthenticator()) throw new Error('This device or browser does not support fingerprint/face/device passkeys.')
  const challenge = randomBytes(32)
  const userId = randomBytes(16)
  const credential = await navigator.credentials.create({ publicKey: {
    challenge,
    rp: { name: 'Rental Manager', id: location.hostname },
    user: { id: userId, name: uid, displayName: displayName || 'Rental Manager user' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    timeout: 60000,
    attestation: 'none',
  } })
  if (!credential) throw new Error('Device credential was not created.')
  const id = base64Url(new Uint8Array(credential.rawId))
  setDeviceSecurity(uid, { enabled: true, method: 'biometric', credentialId: id, createdAt: Date.now() })
  markDeviceUnlocked(uid)
  return id
}

export async function unlockWithBiometric(uid) {
  const cfg = getDeviceSecurity(uid)
  if (!cfg.credentialId) throw new Error('No device biometric is enrolled.')
  const rawId = Uint8Array.from(atob(cfg.credentialId.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
  const assertion = await navigator.credentials.get({ publicKey: {
    challenge: randomBytes(32),
    allowCredentials: [{ id: rawId, type: 'public-key', transports: ['internal'] }],
    userVerification: 'required',
    timeout: 60000,
  } })
  if (!assertion) throw new Error('Device verification was cancelled.')
  markDeviceUnlocked(uid)
  return true
}

export async function setPin(uid, pin) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must contain 4 to 8 digits.')
  const salt = base64Url(randomBytes(16))
  const pinHash = await hashPin(pin, salt)
  setDeviceSecurity(uid, { enabled: true, method: 'pin', salt, pinHash, createdAt: Date.now() })
  markDeviceUnlocked(uid)
}

export async function unlockWithPin(uid, pin) {
  const cfg = getDeviceSecurity(uid)
  if (!cfg.salt || !cfg.pinHash) throw new Error('No PIN is enrolled.')
  const hash = await hashPin(pin, cfg.salt)
  if (hash !== cfg.pinHash) throw new Error('Incorrect device PIN.')
  markDeviceUnlocked(uid)
  return true
}

export function disableDeviceSecurity(uid) {
  if (!uid) return
  localStorage.removeItem(key(uid))
  clearDeviceUnlock(uid)
}
