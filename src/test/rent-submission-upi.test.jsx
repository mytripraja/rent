import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import RentSubmission from '../modules/tenant/RentSubmission'
import { ToastProvider } from '../modules/shared/ui/Toast'
import { openUpiLink } from '../utils/upiDeepLink'
import { getAppConfig } from '../services/configService'

/**
 * Handing off to GPay/PhonePe/Paytm cannot be simulated in jsdom, so the
 * helper that performs the navigation is mocked. Everything else — the flag,
 * the visibility listener, the haptic, the focus and the pulse ring — is the
 * real implementation under test.
 */
vi.mock('../utils/upiDeepLink', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, openUpiLink: vi.fn() }
})

vi.mock('../services/rentService', () => ({
  submitRentPayment: vi.fn(async () => 'APP-42'),
}))

vi.mock('../services/configService', () => ({
  getCashReceivers: vi.fn(async () => ['mom']),
  getAppConfig: vi.fn(async () => ({ upiId: 'owner@ybl', ownerName: 'Owner' })),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', name: 'Tenant', houseId: 'F1' } }),
}))

function stubVibrate(value) {
  Object.defineProperty(navigator, 'vibrate', { value, writable: true, configurable: true })
}

function renderForm() {
  return render(
    <ToastProvider>
      <RentSubmission />
    </ToastProvider>,
  )
}

/** Type the amount, then tap the Quick Pay button. */
async function launchUpi() {
  fireEvent.change(screen.getByPlaceholderText('Amount sent (₹)'), { target: { value: '5000' } })
  const payButton = await screen.findByRole('button', { name: 'Pay via UPI' })
  expect(payButton).toBeEnabled()
  fireEvent.click(payButton)
  return payButton
}

const returnFromApp = () =>
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })

const windowRefocused = () =>
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })

beforeEach(() => stubVibrate(vi.fn()))
afterEach(() => stubVibrate(undefined))

describe('RentSubmission UPI hand-off', () => {
  it('builds a real UPI deep link before navigating away', async () => {
    renderForm()
    await launchUpi()

    expect(openUpiLink).toHaveBeenCalledTimes(1)
    expect(openUpiLink).toHaveBeenCalledWith(expect.stringContaining('upi://pay'))
    expect(openUpiLink).toHaveBeenCalledWith(expect.stringContaining('owner%40ybl'))
  })

  it('does nothing on return when UPI was never launched', async () => {
    renderForm()
    await screen.findByRole('button', { name: 'Pay via UPI' })

    returnFromApp()

    expect(screen.getByTestId('rent-proof-section')).not.toHaveClass('rm-focus-pulse')
    expect(navigator.vibrate).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(screen.getByLabelText('Payment screenshot / UTR'))
  })
})

describe('RentSubmission return from the UPI app', () => {
  it('haptic-pulses, scrolls to and focuses the proof step on visibilitychange', async () => {
    renderForm()
    await launchUpi()
    expect(screen.getByTestId('rent-proof-section')).not.toHaveClass('rm-focus-pulse')

    returnFromApp()

    await waitFor(() => {
      expect(screen.getByTestId('rent-proof-section')).toHaveClass('rm-focus-pulse')
    })
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
    expect(document.activeElement).toBe(screen.getByLabelText('Payment screenshot / UTR'))
  })

  it('also reacts to the window regaining focus', async () => {
    renderForm()
    await launchUpi()

    windowRefocused()

    await waitFor(() => {
      expect(screen.getByTestId('rent-proof-section')).toHaveClass('rm-focus-pulse')
    })
    expect(document.activeElement).toBe(screen.getByLabelText('Payment screenshot / UTR'))
  })

  it('handles the return exactly once', async () => {
    renderForm()
    await launchUpi()

    returnFromApp()
    await waitFor(() => expect(screen.getByTestId('rent-proof-section')).toHaveClass('rm-focus-pulse'))

    const hapticCalls = navigator.vibrate.mock.calls.length
    const focused = document.activeElement

    returnFromApp()
    windowRefocused()

    // Give the listeners a chance to run before asserting they bailed out.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(navigator.vibrate.mock.calls.length).toBe(hapticCalls)
    expect(document.activeElement).toBe(focused)
    expect(getAppConfig).toHaveBeenCalled()
  })
})
