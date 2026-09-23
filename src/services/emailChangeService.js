import { authedFetch } from './firebase'

export function requestEmailChange({ newEmail, oldEmailUnavailable = false, reason = '' }) {
  return authedFetch('/api/update-tenant-contact', {
    action: 'email-change-request', newEmail, oldEmailUnavailable, reason,
  })
}

export function verifyEmailChange({ requestId, oldOtp, newOtp }) {
  return authedFetch('/api/update-tenant-contact', {
    action: 'email-change-verify', requestId, oldOtp, newOtp,
  })
}

export function listEmailChangeRequests() {
  return authedFetch('/api/update-tenant-contact', { action: 'email-change-admin-list' })
}

export function approveEmailChange(requestId) {
  return authedFetch('/api/update-tenant-contact', { action: 'email-change-admin-approve', requestId })
}

export function rejectEmailChange(requestId, note = '') {
  return authedFetch('/api/update-tenant-contact', { action: 'email-change-admin-reject', requestId, note })
}
