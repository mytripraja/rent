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
  blueprint: true,
  calendar: true,
  news: true,
  family: true,
  serviceContacts: true,
}

export async function listHouseTenantAccounts(houseId) {
  return authedFetch('/api/subtenant', { action: 'list', houseId })
}

export async function createSubTenantAccount({ houseId, email, password, name, phone, relationship, permissions }) {
  return authedFetch('/api/subtenant', { action: 'create', houseId, email, password, name, phone, relationship, permissions })
}

export async function updateSubTenantAccount(uid, { name, phone, relationship, permissions, disabled }) {
  return authedFetch('/api/subtenant', { action: 'update', uid, name, phone, relationship, permissions, disabled })
}

export async function deleteSubTenantAccount(uid) {
  return authedFetch('/api/subtenant', { action: 'delete', uid })
}

export async function updateTenantPermissions(uid, tenantPermissions) {
  if (!uid) throw new Error('Tenant account is missing.')
  await updateDoc(doc(db, 'users', uid), { tenantPermissions })
}

export function isPrimaryTenant(user) {
  return user?.role === 'tenant' && user?.accountType !== 'sub'
}

export function tenantCan(user, permission) {
  return user?.role === 'tenant' && user?.tenantPermissions?.[permission] !== false
}

export const TENANT_PERMISSION_LABELS = {
  rent: 'Rent & payment submission',
  bills: 'EB / water bills',
  notices: 'Notices',
  complaints: 'Complaints',
  maintenance: 'Maintenance requests',
  visitors: 'Visitors',
  commonArea: 'Common-area booking',
  documents: 'Documents',
  directory: 'Neighbour directory',
  community: 'Community',
  blueprint: 'Property blueprint',
  calendar: 'Calendar & weather',
  news: 'News Hub',
  family: 'Family accounts',
  serviceContacts: 'Service contacts',
}

export const ALL_TENANT_PERMISSIONS = Object.keys(TENANT_PERMISSION_LABELS)

