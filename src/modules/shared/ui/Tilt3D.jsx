import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Tilt3D — wraps children in a pointer-reactive 3D card.
 *
 * Mouse/trackpad users get the tilt; touch users see plain content (tilt on
 * touch fights scrolling). When the user prefers reduced motion the tilt is
 * skipped entirely and children render untouched.
 *
 * @param {number}  max       max rotation in degrees per axis
 * @param {number}  scale     scale applied while hovering
 * @param {boolean} glare     soft light that follows the pointer
 * @param {string}  className classes for the outer (perspective) wrapper
 */
export default function Tilt3D({ children, className = '', max = 9, scale = 1.015, glare = true }) {
  const ref = useRef(null)
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const glareOpacity = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 240, damping: 24, mass: 0.4 })
  const sy = useSpring(my, { stiffness: 240, damping: 24, mass: 0.4 })

  const rotateY = useTransform(sx, [0, 1], [-max, max])
  const rotateX = useTransform(sy, [0, 1], [max, -max])
  const glowX = useTransform(sx, [0, 1], ['15%', '85%'])
  const glowY = useTransform(sy, [0, 1], ['15%', '85%'])
  const glareBg = useMotionTemplate`radial-gradient(300px circle at ${glowX} ${glowY}, rgba(255,255,255,.3), transparent 55%)`

  function handleMove(event) {
    if (prefersReducedMotion() || event.pointerType === 'touch') return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((event.clientX - rect.left) / rect.width)
    my.set((event.clientY - rect.top) / rect.height)
    if (glare) glareOpacity.set(1)
  }

  function handleLeave() {
    mx.set(0.5)
    my.set(0.5)
    glareOpacity.set(0)
  }

  return (
    <div
      ref={ref}
      className={`rm-scene ${className}`}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <motion.div
        className="rm-3d relative h-full w-full"
        style={{ rotateX, rotateY }}
        whileHover={prefersReducedMotion() ? undefined : { scale }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {children}
        {glare && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: glareBg, opacity: glareOpacity }}
          />
        )}
      </motion.div>
    </div>
  )
}
