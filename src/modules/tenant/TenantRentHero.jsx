import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RotateCw } from 'lucide-react'
import { hapticLight } from '../../utils/haptics'
import { getTenantHouseProfile } from '../../services/houseService'
import { getTenantRentStatus, currentMonthStr } from '../../services/rentService'
import { useAuth } from '../../context/AuthContext'
import ApprovalStatusBadge from '../shared/ApprovalStatusBadge'

export default function TenantRentHero({ onPayNow, canSubmit = true, showDetails = true }) {
  const { user } = useAuth()
  const [house, setHouse] = useState(null)
  const [status, setStatus] = useState('not_paid')
  const [flipped, setFlipped] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (user?.houseId) load()
  }, [user])

  async function load() {
    const h = await getTenantHouseProfile()
    setHouse(h)
    const result = await getTenantRentStatus(currentMonthStr())
    setStatus(result.status || 'not_paid')
  }

  if (!house) return <div className="rm-card p-5 animate-pulse"><div className="h-3 w-28 bg-ink/10 rounded"/><div className="h-9 w-36 bg-ink/10 rounded mt-3"/><div className="h-8 w-24 bg-ink/10 rounded mt-3"/></div>

  const rentAmount = Number(house.rentAmount || 0)
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="tenant-rent-perspective relative w-full select-none" style={{ perspective: '1200px' }}>
      <motion.div
        className="tenant-rent-flip relative w-full"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        animate={{ rotateY: flipped && !reduceMotion ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <section className="tenant-rent-face relative min-h-52 bg-cover text-paper rounded-2xl p-5 sm:p-6 shadow-lg overflow-hidden" style={{ backfaceVisibility: 'hidden' }} aria-label="Current rent summary">
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-brass/10 pointer-events-none" aria-hidden="true" />
          <div className="tenant-rent-glare pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono-tab text-xs text-brass-light uppercase tracking-wide">{monthLabel} · House {house.internalDoorNumber}</p>
              {showDetails && <p className="font-display text-3xl sm:text-4xl mt-1 tracking-tight">₹{rentAmount.toLocaleString('en-IN')}</p>}
              <div className="mt-2 flex items-center gap-2 flex-wrap"><ApprovalStatusBadge status={status} />{showDetails && <span className="text-[11px] text-paper/70">Monthly rent</span>}</div>
            </div>
            {status !== 'paid' && canSubmit && <button onClick={e => { e.stopPropagation(); onPayNow?.() }} className="relative z-10 shrink-0 min-h-11 bg-brass text-cover-dark font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-brass-light transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-light">{status === 'waiting_approval' ? 'View Status' : 'Pay Now'}</button>}
          </div>
          <button type="button" onClick={() => { hapticLight(); setFlipped(v => !v) }} className="relative mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-light" aria-label="Flip card to view rent breakdown">
            <RotateCw size={14} /> View rent breakdown
          </button>
        </section>
        <section className="tenant-rent-face tenant-rent-back absolute inset-0 min-h-52 rounded-2xl bg-cover text-paper p-5 sm:p-6 shadow-lg overflow-hidden" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }} aria-label="Rent breakdown" aria-hidden={!flipped}>
          <p className="font-mono-tab text-xs text-brass-light uppercase tracking-wide">{monthLabel} · Rent breakdown</p>
          <h3 className="font-display text-2xl font-extrabold mt-2">₹{rentAmount.toLocaleString('en-IN')}</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3 border-b border-white/10 pb-2"><span className="text-white/75">Base monthly rent</span><strong>₹{rentAmount.toLocaleString('en-IN')}</strong></div>
            <p className="text-xs leading-relaxed text-white/65">EB and water bill shares are shown separately when they are available in your bill records. This card does not estimate missing charges.</p>
          </div>
          <button type="button" onClick={() => { hapticLight(); setFlipped(false) }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-light"><RotateCw size={14}/> Back to rent status</button>
        </section>
      </motion.div>
      <button type="button" className="sr-only" tabIndex={-1} aria-hidden="true" onClick={() => setFlipped(false)}>Close breakdown</button>
    </div>
  )
}
