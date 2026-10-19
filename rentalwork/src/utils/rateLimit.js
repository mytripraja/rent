const timestamps = {}
export function canPerformAction(actionKey, cooldownMs = 2000) {
  const now = Date.now()
  if (timestamps[actionKey] && now - timestamps[actionKey] < cooldownMs) return false
  timestamps[actionKey] = now
  return true
}
