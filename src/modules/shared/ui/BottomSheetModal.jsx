import { triggerHaptic } from '../../../utils/haptics'

/**
 * Shared mobile bottom-sheet layer.
 *
 * Every modal in the app that docks to the bottom on phones reuses three
 * pieces from here so the behaviour (and its thresholds) live in exactly one
 * place:
 *
 *   - `sheetDragProps({ onClose, controls })` → props to spread onto a
 *     framer-motion panel so dragging it down past the threshold dismisses it.
 *   - `<SheetDragHandle onStartDrag={…} />` → the mobile-only grab pill that
 *     *starts* the drag. Pair it with `useDragControls()` so scrolling the
 *     modal body never fights the drag gesture.
 *   - `shouldDismissSheet(info)` → the pure threshold test, exported so it can
 *     be unit tested without pointer simulation.
 *
 * The thresholds are tuned for a one-handed flick: 90px of travel, or a fast
 * (400px/s) fling, either of which reads as "throw this away".
 */

export const SHEET_DISMISS_OFFSET_Y = 90
export const SHEET_DISMISS_VELOCITY_Y = 400

/** True when a drag gesture has travelled far or fast enough to close. */
export function shouldDismissSheet(info) {
  const offset = info?.offset || {}
  const velocity = info?.velocity || {}
  return (
    (Number(offset.y) || 0) > SHEET_DISMISS_OFFSET_Y ||
    (Number(velocity.y) || 0) > SHEET_DISMISS_VELOCITY_Y
  )
}

/**
 * Framer Motion props for swipe-down-to-dismiss.
 *
 * Pass `controls` (from `useDragControls()`) to only allow the drag to start
 * from an explicit grab zone — required for modals with internal scrolling
 * content, where a listener on the panel would steal scroll gestures.
 */
export function sheetDragProps({ onClose, controls = null } = {}) {
  const props = {
    drag: 'y',
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.6 },
    dragMomentum: false,
    onDragEnd: (_event, info) => {
      if (!shouldDismissSheet(info)) return
      triggerHaptic('light')
      onClose?.()
    },
  }

  if (controls) {
    props.dragControls = controls
    props.dragListener = false
  }

  return props
}

/**
 * The mobile-only grab pill. Render it as the first child of the sheet panel
 * and hand it the `start` callback from `useDragControls()`.
 */
export function SheetDragHandle({ onStartDrag, className = '' }) {
  return (
    <div
      onPointerDown={onStartDrag}
      className={`touch-none select-none px-4 pt-3 sm:hidden ${className}`}
      data-testid="sheet-drag-handle"
    >
      <div className="w-10 h-1.5 rounded-full bg-slate-400/40 mx-auto mb-3 sm:hidden" aria-hidden="true" />
    </div>
  )
}
