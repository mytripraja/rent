import { collection, getDocs, query, where, updateDoc, doc, orderBy } from 'firebase/firestore'
import { db, authedFetch } from './firebase'

export const DEFAULT_TENANT_PERMISSIONS = {
  rent: true,
  bills: true,
  notices: true,
  complaints: true,
  maintenance: true,
  visitors: true,
  commonArea: true,
  documents: true,
  directory: true,
  community: true,
}

export async function listHouseTenantAccounts(houseId) {
  return authedFetch('/api/list-subtenants', { houseId })
}

export async function createSubTenantAccount({ houseId, email, password, name, phone, relationship, permissions }) {
  return authedFetch('/api/create-subtenant', { houseId, email, password, name, phone, relationship, permissions })
}

export async function updateSubTenantAccount(uid, { name, phone, relationship, permissions, disabled }) {
  return authedFetch('/api/update-subtenant', { uid, name, phone, relationship, permissions, disabled })
}

export async function deleteSubTenantAccount(uid) {
  return authedFetch('/api/delete-subtenant', { uid })
}

export function isPrimaryTenant(user) {
  return user?.role === 'tenant' && user?.accountType !== 'sub'
}

export function tenantCan(user, permission) {
  return isPrimaryTenant(user) || user?.tenantPermissions?.[permission] !== false
}
