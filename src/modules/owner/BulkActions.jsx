import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Zap } from 'lucide-react'

export default function BulkActions({ selectedHouses, onAction, onClear }) {
  return (
    <AnimatePresence>
      {selectedHouses.length > 0 && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-safe bg-paper-raised border-t border-brass/30 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-6"
        >
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={onClear} className="p-1 rounded-full hover:bg-black/5 text-ink-soft" title="Clear selection">
                <X size={20} />
              </button>
              <span className="font-medium text-ink">{selectedHouses.length} houses selected</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => onAction('notice')} className="bg-cover text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-cover/90 transition-colors shadow-sm">
                <Bell size={16} /> Send Notice
              </button>
              <button onClick={() => onAction('reminder')} className="bg-cover text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-cover/90 transition-colors shadow-sm">
                <Zap size={16} /> Send Reminder
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
