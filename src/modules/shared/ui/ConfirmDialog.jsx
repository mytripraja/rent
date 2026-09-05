import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from './Button'

/**
 * A styled confirmation dialog to replace window.confirm() and window.prompt()
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // 'danger' | 'warning' | 'default'
  children
}) {
  // Escape key handler
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  const getConfirmVariant = () => {
    switch (variant) {
      case 'danger': return 'danger'
      case 'warning': return 'secondary' 
      default: return 'primary'
    }
  }

  const getHeaderColor = () => {
    switch (variant) {
      case 'danger': return 'text-stamp-red'
      case 'warning': return 'text-stamp-amber'
      default: return 'text-cover'
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-desc"
            className="relative w-full max-w-md bg-paper-raised rounded-xl shadow-xl border border-brass/20 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-brass/10">
              <h2 id="dialog-title" className={`font-display text-xl font-semibold ${getHeaderColor()}`}>
                {title}
              </h2>
            </div>

            {/* Body */}
            <div className="p-6 py-4">
              {message && (
                <p id="dialog-desc" className="text-ink-soft text-sm">
                  {message}
                </p>
              )}
              {children && (
                <div className="mt-4">
                  {children}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 flex items-center justify-end gap-3 bg-paper/50">
              <Button
                variant="secondary"
                onClick={onClose}
                autoFocus
              >
                {cancelText}
              </Button>
              <Button
                variant={getConfirmVariant()}
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
