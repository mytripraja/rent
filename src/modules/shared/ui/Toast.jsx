import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const ToastContext = createContext(null)

const VARIANTS = {
  success: 'border-stamp-green',
  error: 'border-stamp-red',
  warning: 'border-stamp-amber',
  info: 'border-cover'
}

const TEXT_VARIANTS = {
  success: 'text-stamp-green',
  error: 'text-stamp-red',
  warning: 'text-stamp-amber',
  info: 'text-cover'
}

const BG_VARIANTS = {
  success: 'bg-stamp-green',
  error: 'bg-stamp-red',
  warning: 'bg-stamp-amber',
  info: 'bg-cover'
}

function Toast({ id, message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [id, onClose])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto relative w-full sm:w-96 overflow-hidden rounded-lg bg-paper-raised border-l-4 shadow-lg p-4 flex items-start justify-between ${VARIANTS[type] || VARIANTS.info}`}
      role="alert"
      aria-live="assertive"
    >
      <div className={`flex-1 pr-4 text-ink font-display font-medium ${TEXT_VARIANTS[type] || TEXT_VARIANTS.info}`}>
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-ink-soft hover:text-ink transition-colors mt-0.5"
        aria-label="Close notification"
      >
        <X size={18} />
      </button>
      
      {/* Progress bar */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: 0 }}
        transition={{ duration: 4, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-1 ${BG_VARIANTS[type] || BG_VARIANTS.info}`}
      />
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback(({ message, type = 'info' }) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none flex flex-col items-center sm:items-end gap-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <Toast key={toast.id} {...toast} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
