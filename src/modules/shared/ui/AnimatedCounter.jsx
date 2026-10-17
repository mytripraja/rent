import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const formatIndian = (n) => Math.round(n).toLocaleString('en-IN')

/**
 * AnimatedCounter — counts a number up to its value when it appears.
 *
 * Draws on <animateCount> only for numeric display; it renders plain text
 * until the value is known and for anyone who prefers reduced motion.
 *
 * @param {number}  value    target value
 * @param {string}  prefix   prepended (e.g. "₹")
 * @param {string}  suffix   appended (e.g. "+")
 * @param {number}  duration animation length in ms
 * @param {boolean} active   set false to show the final value immediately
 */
export default function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 850,
  active = true,
  className = '',
}) {
  const numeric = Number(value)
  const [display, setDisplay] = useState(() => (Number.isFinite(numeric) ? numeric : value))
  const frame = useRef(0)

  useEffect(() => {
    if (!Number.isFinite(numeric)) { setDisplay(value); return }
    if (!active || prefersReducedMotion() || duration <= 0) { setDisplay(numeric); return }

    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      // ease-out-cubic: quick, then settle
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(numeric * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [numeric, value, duration, active])

  return (
    <span className={className}>
      {prefix}
      {typeof display === 'number' ? formatIndian(display) : display}
      {suffix}
    </span>
  )
}
