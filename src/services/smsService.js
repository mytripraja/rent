// SMS Service - requires backend setup with Twilio or MSG91
// For now, falls back to WhatsApp messaging

export async function sendSMS(phoneNumber, message) {
  // TODO: Implement with Twilio/MSG91 when backend is ready
  // For now, use WhatsApp as fallback
  console.warn('SMS service not configured. Using WhatsApp fallback.')
  const { sendWhatsAppMessage } = await import('./whatsappService')
  sendWhatsAppMessage(phoneNumber, message)
}

export function isSMSConfigured() {
  return false // Set to true when Twilio is configured
}
