import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hapticLight, hapticMedium, hapticSuccess, hapticError, triggerHaptic } from '../utils/haptics'

function stubVibrate(value) {
  Object.defineProperty(navigator, 'vibrate', { value, writable: true, configurable: true })
}

beforeEach(() => stubVibrate(vi.fn()))
afterEach(() => stubVibrate(undefined))

describe('haptics', () => {
  it('maps every named style to its vibration pattern', () => {
    triggerHaptic('light')
    expect(navigator.vibrate).toHaveBeenLastCalledWith(10)

    triggerHaptic('medium')
    expect(navigator.vibrate).toHaveBeenLastCalledWith(25)

    triggerHaptic('success')
    expect(navigator.vibrate).toHaveBeenLastCalledWith([10, 50, 20])

    triggerHaptic('error')
    expect(navigator.vibrate).toHaveBeenLastCalledWith([25, 60, 25])

    triggerHaptic('warning')
    expect(navigator.vibrate).toHaveBeenLastCalledWith(25)
  })

  // Guard against a typo silently doing nothing at a call site.
  it('falls back to the lightest tap for an unknown style', () => {
    triggerHaptic('not-a-style')
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('defaults to a light tap when called with no style', () => {
    triggerHaptic()
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('never throws when the device has no vibration support', () => {
    stubVibrate(undefined)
    expect(() => {
      triggerHaptic('success')
      triggerHaptic('unknown')
      hapticLight()
      hapticMedium()
      hapticSuccess()
      hapticError()
    }).not.toThrow()
    expect(navigator.vibrate).toBeUndefined()
  })
})
