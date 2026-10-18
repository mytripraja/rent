export function generateUpiLink({ payeeName, payeeUpi, amount, transactionNote }) {
  const params = new URLSearchParams({
    pa: payeeUpi, // e.g. 'deepu@ybl'
    pn: payeeName,
    am: amount.toString(),
    tn: transactionNote, // e.g. 'Rent for House F1 - Sep 2026'
    cu: 'INR'
  })
  return `upi://pay?${params.toString()}`
}

/**
 * Hand the link to the device's UPI handler.
 *
 * Kept in one place so callers can mark "we launched UPI" *before* calling it,
 * and so tests can intercept the hand-off instead of asking jsdom to navigate.
 */
export function openUpiLink(link) {
  window.location.href = link
}
