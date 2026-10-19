import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, CreditCard, FileText, Home, LockKeyhole, Wallet } from 'lucide-react'
import LoadingScreen from '../shared/LoadingScreen'

function money(value) { return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` }

export default function PublicBill() {
  const { billType, billId } = useParams()
  const [searchParams] = useSearchParams()
  const [bill, setBill] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const token = searchParams.get('token') || ''
  const showPayment = searchParams.get('pay') === '1'
  const showDetails = searchParams.get('details') === '1'

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/public-bill?type=${encodeURIComponent(billType || '')}&id=${encodeURIComponent(billId || '')}&token=${encodeURIComponent(token)}&details=${showDetails ? '1' : '0'}&pay=${showPayment ? '1' : '0'}`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const raw = await response.text()
        let data
        try { data = raw ? JSON.parse(raw) : {} } catch { throw new Error('Bill service is unavailable. Please try again later.') }
        if (!response.ok) throw new Error(data.error || 'Bill not found')
        return data.bill
      })
      .then(data => { if (alive) setBill(data) })
      .catch(err => { if (alive) setError(err.message || 'Bill not found') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [billType, billId, token, showDetails, showPayment])

  if (loading) return <LoadingScreen />
  if (error || !bill) return <main className="min-h-screen bg-paper grid place-items-center p-6"><div className="rm-card p-6 max-w-md text-center"><AlertTriangle className="mx-auto text-stamp-amber"/><h1 className="font-semibold text-ink mt-3">Bill link unavailable</h1><p className="text-sm text-ink-soft mt-2">{error || 'This bill could not be found.'}</p><Link to="/login" className="inline-flex mt-4 rounded-xl bg-brand text-white px-4 py-2 text-sm font-semibold">Sign in</Link></div></main>

  const returnTo = `/tenant?billType=${bill.type}&billId=${encodeURIComponent(bill.id)}`
  const payUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`
  const payment = bill.paymentDetails || {}
  const hasPaymentDetails = !!(payment.upiId || payment.accountNumber || payment.bankName)
  return <main className="min-h-screen bg-paper text-ink p-4 sm:p-8"><article className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-brass/20 bg-paper-raised shadow-xl">
    <header className="bg-slate-900 p-6 sm:p-8 text-white"><p className="text-xs uppercase tracking-[.18em] text-emerald-300 font-semibold">Rental Manager · {bill.type === 'eb' ? 'EB Bill' : 'Water Bill'}</p><h1 className="mt-2 text-2xl sm:text-3xl font-bold">{bill.title}</h1><p className="mt-2 text-sm text-white/70">Bill details and payment information</p></header>
    <div className="space-y-5 p-5 sm:p-8">
      <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-brass/20 bg-paper p-4"><p className="text-xs text-ink-soft">Total bill amount</p><p className="mt-1 text-2xl font-bold">{money(bill.totalAmount)}</p></div><div className="rounded-2xl border border-brass/20 bg-paper p-4"><p className="text-xs text-ink-soft flex items-center gap-2"><CalendarClock size={14}/> Last date to pay</p><p className="mt-1 text-lg font-semibold">{bill.dueDate || 'Not specified'}</p></div></section>
      {bill.note && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold text-sm flex items-center gap-2"><FileText size={16}/> Note from property manager</h2><p className="mt-2 text-sm whitespace-pre-wrap">{bill.note}</p></section>}
      {(bill.cycleMonths || bill.consumptionUnits != null || bill.previousMeterReading != null || bill.currentMeterReading != null) && <section className="rounded-2xl border border-brass/20 p-4"><h2 className="font-semibold text-sm">Bill information</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm">{bill.cycleMonths && <Info label="Cycle length" value={`${bill.cycleMonths} month(s)`}/>}{bill.consumptionUnits != null && <Info label="Units used" value={`${bill.consumptionUnits} units`}/>}{bill.previousMeterReading != null && <Info label="Previous reading" value={bill.previousMeterReading}/>}{bill.currentMeterReading != null && <Info label="Current reading" value={bill.currentMeterReading}/>}{bill.meterReadingDate && <Info label="Reading date" value={bill.meterReadingDate}/>}{bill.meterReadingTime && <Info label="Reading time" value={bill.meterReadingTime}/>}</div></section>}
      {showDetails && <section><h2 className="font-semibold flex items-center gap-2"><Home size={17}/> House-wise share details</h2><div className="mt-3 overflow-hidden rounded-2xl border border-brass/20"><div className="grid grid-cols-[1fr_auto] gap-3 bg-paper px-4 py-3 text-xs font-semibold text-ink-soft"><span>Resident / House</span><span>Share</span></div>{(bill.shares || []).map((share, index) => <div key={`${share.houseId}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-t border-brass/10 px-4 py-3 text-sm"><div><p className="font-medium">{share.residentName}</p><p className="text-xs text-ink-soft">House {share.houseLabel}{share.monthsOccupied != null ? ` · ${share.monthsOccupied} month(s)` : ''}</p></div><p className="font-semibold tabular-nums">{money(share.shareAmount)}</p></div>)}{!bill.shares?.length && <p className="p-4 text-sm text-ink-soft">No house-wise breakdown was included in this link.</p>}</div><p className="mt-2 text-xs text-ink-soft">Each resident's final payable amount is shown only after sign-in.</p></section>}
      {showPayment && <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><h2 className="font-semibold flex items-center gap-2"><Wallet size={17}/> Payment details</h2>{hasPaymentDetails ? <div className="mt-3 space-y-2 text-sm">{payment.payeeName && <Info label="Payee name" value={payment.payeeName}/>}{payment.upiId && <Info label="UPI ID" value={payment.upiId}/>}{payment.bankName && <Info label="Bank" value={payment.bankName}/>}{payment.accountName && <Info label="Account holder" value={payment.accountName}/>}{payment.accountNumber && <Info label="Account number" value={payment.accountNumber}/>}{payment.ifsc && <Info label="IFSC" value={payment.ifsc}/>}{payment.paymentInstructions && <p className="whitespace-pre-wrap text-ink-soft">{payment.paymentInstructions}</p>}</div> : <p className="mt-2 text-sm text-ink-soft">The property manager has not added payment account details for this bill.</p>}</section>}
      {showPayment && <section className="rounded-2xl border border-brass/20 p-4"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 text-brand" size={20}/><div><h2 className="font-semibold">Pay your share</h2><p className="mt-1 text-sm text-ink-soft">Sign in to view your house's exact amount. Your amount may differ from other houses. The payment form will keep the calculated amount fixed and let you submit proof for owner verification.</p></div></div><a href={payUrl} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white"><CreditCard size={17}/> Sign in to view amount & pay</a></section>}
      <p className="border-t border-brass/15 pt-4 text-xs text-ink-soft">This is a bill detail link. Payment is not confirmed until the property manager verifies the payment proof.</p>
    </div>
  </article></main>
}
function Info({ label, value }) { return <div className="flex justify-between gap-3"><span className="text-xs text-ink-soft">{label}</span><span className="text-sm font-medium text-right break-all">{value}</span></div> }
