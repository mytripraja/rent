export function sendWhatsAppMessage(phoneNumber, message) {
  // Remove +91 prefix handling, ensure 10-digit number
  const cleanNumber = phoneNumber?.replace(/\D/g, '').slice(-10) || ''
  if (!cleanNumber) return
  const fullNumber = `91${cleanNumber}`
  const encoded = encodeURIComponent(message)
  window.open(`https://wa.me/${fullNumber}?text=${encoded}`, '_blank')
}

export function generateRentReminderMessage(tenantName, doorNumber, month, amount) {
  return `Hi ${tenantName},\n\nThis is a reminder that your rent of ₹${amount} for ${month} (House ${doorNumber}) is pending.\n\nPlease pay at your earliest convenience.\n\nThank you,\nRental Manager`
}

export function generateRentReceiptMessage(tenantName, doorNumber, month, amount, receiptNo) {
  return `Hi ${tenantName},\n\n✅ Your rent payment has been approved!\n\n🏠 House: ${doorNumber}\n📅 Month: ${month}\n💰 Amount: ₹${amount}\n🧾 Receipt: ${receiptNo}\n\nThank you!`
}

export function generateNoticeMessage(title, message) {
  return `📢 Notice: ${title}\n\n${message}\n\n- Rental Manager`
}
