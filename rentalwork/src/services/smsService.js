/**
 * SMS is deliberately disabled until a server-side SMS provider is configured.
 * Keeping this explicit avoids silently sending a WhatsApp message when a user
 * asked for SMS, which is confusing and can lead to duplicate notifications.
 */
export async function sendSMS() {
  throw new Error('SMS is not configured. Add an SMS provider on the server before enabling this action.')
}

export function isSMSConfigured() {
  return false
}
