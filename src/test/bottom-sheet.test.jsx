import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  SheetDragHandle,
  shouldDismissSheet,
  sheetDragProps,
  SHEET_DISMISS_OFFSET_Y,
  SHEET_DISMISS_VELOCITY_Y,
} from '../modules/shared/ui/BottomSheetModal'
import ConfirmDialog from '../modules/shared/ui/ConfirmDialog'

function stubVibrate(value) {
  Object.defineProperty(navigator, 'vibrate', { value, writable: true, configurable: true })
}

beforeEach(() => stubVibrate(vi.fn()))
afterEach(() => stubVibrate(undefined))

describe('bottom sheet drag thresholds', () => {
  it('exposes the documented thresholds', () => {
    expect(SHEET_DISMISS_OFFSET_Y).toBe(90)
    expect(SHEET_DISMISS_VELOCITY_Y).toBe(400)
  })

  it('keeps the sheet open below the offset threshold', () => {
    expect(shouldDismissSheet({ offset: { y: 90 }, velocity: { y: 0 } })).toBe(false)
    expect(shouldDismissSheet({ offset: { y: 0 }, velocity: { y: 400 } })).toBe(false)
  })

  it('closes past offset.y > 90', () => {
    expect(shouldDismissSheet({ offset: { y: 91 }, velocity: { y: 0 } })).toBe(true)
  })

  it('closes on a fast fling that has not travelled far', () => {
    expect(shouldDismissSheet({ offset: { y: 30 }, velocity: { y: 401 } })).toBe(true)
  })

  it('ignores an upward drag', () => {
    expect(shouldDismissSheet({ offset: { y: -180 }, velocity: { y: -900 } })).toBe(false)
  })

  it('treats a malformed gesture as "keep open"', () => {
    expect(shouldDismissSheet(undefined)).toBe(false)
    expect(shouldDismissSheet({})).toBe(false)
    expect(shouldDismissSheet({ offset: {}, velocity: {} })).toBe(false)
  })
})

describe('sheetDragProps', () => {
  const dragInfo = (offsetY, velocityY = 0) => ({ offset: { y: offsetY }, velocity: { y: velocityY } })

  it('uses the spec\'s vertical drag constraints and bottom-only elasticity', () => {
    const props = sheetDragProps({ onClose: vi.fn() })
    expect(props.drag).toBe('y')
    expect(props.dragConstraints).toEqual({ top: 0, bottom: 0 })
    expect(props.dragElastic).toEqual({ top: 0, bottom: 0.6 })
    expect(props.dragMomentum).toBe(false)
  })

  it('calls onClose and fires the light haptic when offset.y > 90', () => {
    const onClose = vi.fn()
    sheetDragProps({ onClose }).onDragEnd(null, dragInfo(95))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('calls onClose on a fast fling (velocity.y > 400)', () => {
    const onClose = vi.fn()
    sheetDragProps({ onClose }).onDragEnd(null, dragInfo(40, 650))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('leaves the sheet open (and silent) for a short, slow drag', () => {
    const onClose = vi.fn()
    sheetDragProps({ onClose }).onDragEnd(null, dragInfo(40, 120))

    expect(onClose).not.toHaveBeenCalled()
    expect(navigator.vibrate).not.toHaveBeenCalled()
  })

  it('supports dragControls so scrolling content never starts the drag', () => {
    const controls = { start: vi.fn() }
    const props = sheetDragProps({ onClose: vi.fn(), controls })

    expect(props.dragListener).toBe(false)
    expect(props.dragControls).toBe(controls)
  })

  it('tolerates a missing onClose', () => {
    expect(() => sheetDragProps({}).onDragEnd(null, dragInfo(500))).not.toThrow()
  })
})

describe('SheetDragHandle', () => {
  it('renders the mobile-only pill with the documented classes', () => {
    render(<SheetDragHandle />)
    const pill = document.querySelector('[aria-hidden="true"]')
    expect(pill).toBeInTheDocument()
    expect(pill.className).toContain('w-10')
    expect(pill.className).toContain('h-1.5')
    expect(pill.className).toContain('rounded-full')
    expect(pill.className).toContain('bg-slate-400/40')
    expect(pill.className).toContain('mx-auto')
    expect(pill.className).toContain('mb-3')
    expect(pill.className).toContain('sm:hidden')
  })

  it('starts the drag from a generous grab zone', () => {
    const start = vi.fn()
    const { container } = render(<SheetDragHandle onStartDrag={start} />)
    const zone = container.querySelector('[data-testid="sheet-drag-handle"]')

    expect(zone.className).toContain('sm:hidden')
    expect(zone.className).toContain('touch-none')
    fireEvent.pointerDown(zone)
    expect(start).toHaveBeenCalledTimes(1)
  })
})

describe('ConfirmDialog bottom-sheet treatment', () => {
  it('docks to the bottom, rounds the top and offers a drag pill', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Approve payment?"
        message="This marks the month as paid."
      />,
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.className).toContain('rounded-t-3xl')
    expect(dialog.className).toContain('sm:rounded-2xl')
    expect(dialog.closest('.items-end')).toBeTruthy()

    // Pill is rendered (and only ever shown below the sm breakpoint).
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument()

    // Safe-area clearance lives on the footer so it never shows as a gap.
    const footer = screen.getByRole('button', { name: 'Confirm' }).parentElement
    expect(footer.className).toContain('pb-safe')
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={() => {}} title="Discard draft?" message="Changes are lost." />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
