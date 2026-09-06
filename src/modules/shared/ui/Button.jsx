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
  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      onTap={() => {
        if (!disabled && !loading) hapticLight()
      }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`rounded-full font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${sizeClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (loadingText || 'Please wait…') : children}
    </motion.button>
  )
}
