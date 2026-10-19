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
