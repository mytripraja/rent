export function hapticLight() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
}
export function hapticMedium() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)
}
export function hapticSuccess() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 50, 20])
}
export function hapticError() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([25, 60, 25])
}

/**
 * Named feedback styles so call sites read as intent rather than a duration.
 * Unknown styles fall back to the lightest tap instead of throwing.
 */
const PATTERNS = {
  light: hapticLight,
  medium: hapticMedium,
  success: hapticSuccess,
  error: hapticError,
  warning: hapticMedium,
}

export function triggerHaptic(style = 'light') {
  const run = PATTERNS[style] || hapticLight
  run()
}
