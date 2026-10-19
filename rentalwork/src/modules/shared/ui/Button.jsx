import { motion } from 'framer-motion'
import { hapticLight } from '../../../utils/haptics'

const VARIANTS = {
  primary: 'bg-cover text-paper hover:bg-cover-dark',
  secondary: 'bg-paper text-ink-soft border border-brass/30 hover:bg-paper-raised',
  danger: 'bg-stamp-red text-paper hover:opacity-90',
  ghost: 'text-brand hover:underline bg-transparent',
}

export default function Button({
  variant = 'primary',
  loading = false,
  loadingText,
  fullWidth = false,
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'py-2.5 px-5 text-sm'
  const isBlocked = disabled || loading
  return (
    <motion.button
      whileTap={{ scale: isBlocked ? 1 : 0.97 }}
      whileHover={isBlocked ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      onTap={() => {
        if (!isBlocked) hapticLight()
      }}
      disabled={isBlocked}
      aria-busy={loading || undefined}
      className={`rm-sheen rounded-xl font-semibold transition shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${sizeClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="rm-dots" aria-hidden="true"><i /><i /><i /></span>
          {loadingText || 'Please wait…'}
        </span>
      ) : (
        children
      )}
    </motion.button>
  )
}
