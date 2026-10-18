import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import EBApprovalQueue from '../modules/owner/EBApprovalQueue'
import WaterApprovalQueue from '../modules/owner/WaterApprovalQueue'
import { ToastProvider } from '../modules/shared/ui/Toast'
import { approveEbPayment, rejectEbPayment } from '../services/ebBillService'
import { approveWaterPayment, rejectWaterPayment } from '../services/waterBillService'

/**
 * Swipe gestures cannot be simulated reliably in jsdom, so the swipe card is
 * replaced with a stub that exposes its `onApprove` / `onReject` callbacks as
 * buttons. That exercises the contract the deliverable cares about: each queue
 * hands the *right* handlers to the card, and those handlers drive the right
 * service call with the right arguments.
 */
vi.mock('../modules/shared/ui/SwipeableApprovalCard', async () => {
  const React = await import('react')
  const createElement = React.createElement || React.default.createElement
  return {
    default: function MockSwipeCard({ onApprove, onReject, children }) {
      return createElement(
        'div',
        { 'data-testid': 'swipe-card' },
        createElement('button', { type: 'button', onClick: onApprove }, 'swipe-approve'),
        createElement('button', { type: 'button', onClick: onReject }, 'swipe-reject'),
        children,
      )
    },
  }
})

vi.mock('../services/ebBillService', () => ({
  listPendingEbApprovals: vi.fn(async () => [
    {
      id: 'eb-1',
      houseId: 'h1',
      amount: 480,
      mode: 'upi',
      dateSent: '2026-10-01',
      applicationNumber: 'EB-1001',
      proofUrl: 'https://cdn.example.com/eb-proof.png',
      recordedBy: { uid: 'u2', name: 'Tenant' },
    },
  ]),
  approveEbPayment: vi.fn(async () => undefined),
  rejectEbPayment: vi.fn(async () => undefined),
}))

vi.mock('../services/waterBillService', () => ({
  listPendingWaterApprovals: vi.fn(async () => [
    {
      id: 'wt-1',
      houseId: 'h1',
      amount: 250,
      mode: 'upi',
      dateSent: '2026-10-02',
      applicationNumber: 'WT-1001',
      proofUrl: 'https://cdn.example.com/water-proof.png',
      recordedBy: { uid: 'u2', name: 'Tenant' },
    },
  ]),
  approveWaterPayment: vi.fn(async () => undefined),
  rejectWaterPayment: vi.fn(async () => undefined),
}))

vi.mock('../services/houseService', () => ({
  listHouses: vi.fn(async () => [{ id: 'h1', internalDoorNumber: 'F1' }]),
}))

vi.mock('../services/configService', () => ({
  getCashReceivers: vi.fn(async () => ['mom']),
}))

vi.mock('../services/cloudinaryService', () => ({
  getPaymentProofUrl: vi.fn(async () => 'https://cdn.example.com/resolved.png'),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', name: 'Owner', role: 'owner' } }),
}))

function renderQueue(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

const QUEUES = [
  {
    name: 'EBApprovalQueue',
    Queue: EBApprovalQueue,
    approve: approveEbPayment,
    reject: rejectEbPayment,
    paymentId: 'eb-1',
    appNo: /App# EB-1001/,
    amount: /₹480/,
  },
  {
    name: 'WaterApprovalQueue',
    Queue: WaterApprovalQueue,
    approve: approveWaterPayment,
    reject: rejectWaterPayment,
    paymentId: 'wt-1',
    appNo: /App# WT-1001/,
    amount: /₹250/,
  },
]

describe.each(QUEUES)('$name swipe callbacks', ({ Queue, approve, reject, paymentId, appNo, amount }) => {
  it('swipe right approves the pending payment', async () => {
    renderQueue(<Queue />)
    fireEvent.click(await screen.findByText('swipe-approve'))

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1))
    expect(approve.mock.calls[0][0]).toBe(paymentId)
    expect(approve.mock.calls[0][1]).toEqual({ actionedBy: { uid: 'u1', name: 'Owner' } })
  })

  it('swipe left opens the reason dialog and rejects with it', async () => {
    renderQueue(<Queue />)
    fireEvent.click(await screen.findByText('swipe-reject'))

    const heading = await screen.findByText('Reason for rejection')
    const dialog = heading.closest('.fixed')
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Amount does not match the receipt' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))

    await waitFor(() => expect(reject).toHaveBeenCalledTimes(1))
    expect(reject.mock.calls[0][0]).toBe(paymentId)
    expect(reject.mock.calls[0][1]).toBe('Amount does not match the receipt')
    expect(reject.mock.calls[0][2]).toEqual({ uid: 'u1', name: 'Owner' })
  })

  it('keeps the card details and the 44px fallback buttons', async () => {
    renderQueue(<Queue />)
    expect(await screen.findByText(/House F1/)).toBeInTheDocument()
    expect(screen.getByText(amount)).toBeInTheDocument()
    expect(screen.getByText(appNo)).toBeInTheDocument()

    for (const label of ['Approve', 'Reject']) {
      const button = screen.getByRole('button', { name: label })
      expect(button.className).toContain('min-h-11')
    }
  })

  it('does not reject when the reason is left blank', async () => {
    renderQueue(<Queue />)
    fireEvent.click(await screen.findByText('swipe-reject'))
    const heading = await screen.findByText('Reason for rejection')
    const dialog = heading.closest('.fixed')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))

    expect(await screen.findByText('Please enter a reason')).toBeInTheDocument()
    expect(reject).not.toHaveBeenCalled()
  })
})
