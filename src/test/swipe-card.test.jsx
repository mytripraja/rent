import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SwipeableApprovalCard from '../modules/shared/ui/SwipeableApprovalCard'

function renderCard(props = {}) {
  return render(
    <SwipeableApprovalCard onApprove={() => {}} onReject={() => {}} hint="← Reject | Approve →" {...props}>
      <p>Tenant submission row</p>
    </SwipeableApprovalCard>
  )
}

describe('SwipeableApprovalCard', () => {
  it('renders children alongside the reveal labels and hint', () => {
    renderCard()
    expect(screen.getByText('Tenant submission row')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
    expect(screen.getByText('← Reject | Approve →')).toBeInTheDocument()
  })

  it('respects custom labels', () => {
    renderCard({ approveLabel: 'Accept', rejectLabel: 'Decline' })
    expect(screen.getByText('Accept')).toBeInTheDocument()
    expect(screen.getByText('Decline')).toBeInTheDocument()
  })

  it('hides the hint when none is supplied', () => {
    render(<SwipeableApprovalCard><p>row</p></SwipeableApprovalCard>)
    expect(screen.queryByText('← Reject | Approve →')).not.toBeInTheDocument()
  })

  // Swipe is hard to simulate in jsdom, so lock down the accessible fallback:
  // the buttons inside must still work, since not everyone can drag.
  it('keeps nested action buttons clickable', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(
      <SwipeableApprovalCard onApprove={onApprove} onReject={onReject}>
        <button onClick={onApprove}>Confirm approval</button>
        <button onClick={onReject}>Open rejection</button>
      </SwipeableApprovalCard>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open rejection' }))
    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledTimes(1)
  })
})
