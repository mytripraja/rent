import { motion, useMotionValue, useTransform } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { triggerHaptic } from '../../../utils/haptics'

/**
 * Drag a card left to reject or right to approve.
 *
 * The tinted background reveals the hidden action as the card moves, and the
 * gesture fires haptic feedback once the threshold is crossed. Children stay
 * fully interactive, so the tappable Approve/Reject buttons remain available
 * for anyone who cannot or does not want to swipe.
 */
export default function SwipeableApprovalCard({
  children,
  onApprove,
  onReject,
  threshold = 140,
  rejectLabel = 'Reject',
  approveLabel = 'Approve',
  hint = null,
  className = '',
}) {
  const x = useMotionValue(0)

  const tint = useTransform(
    x,
    [-threshold, 0, threshold],
    ['rgba(220, 38, 38, .22)', 'rgba(0, 0, 0, 0)', 'rgba(16, 185, 129, .22)']
  )
  const rejectStrength = useTransform(x, [-threshold, -30], [1, 0])
  const approveStrength = useTransform(x, [30, threshold], [0, 1])

  function handleDragEnd(_event, info) {
    if (info.offset.x > threshold) {
      triggerHaptic('success')
      onApprove?.()
    } else if (info.offset.x < -threshold) {
      triggerHaptic('error')
      onReject?.()
    }
  }

  return (
    <motion.div
      layout
      className={`relative overflow-hidden rounded-xl border border-brass/20 bg-paper-raised shadow-sm ${className}`}
    >
      <motion.div
        aria-hidden="true"
        style={{ backgroundColor: tint }}
        className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none"
      >
        <span
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-stamp-red"
          style={{ opacity: rejectStrength }}
        >
          <XCircle size={16} /> {rejectLabel}
        </span>
        <span
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-stamp-green"
          style={{ opacity: approveStrength }}
        >
          {approveLabel} <CheckCircle2 size={16} />
        </span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.995 }}
        style={{ x, position: 'relative', zIndex: 10 }}
        className="bg-paper-raised"
      >
        {children}
      </motion.div>

      {hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-paper-raised/80 py-1 text-center text-[11px] text-ink-soft opacity-60">
          {hint}
        </div>
      )}
    </motion.div>
  )
}
