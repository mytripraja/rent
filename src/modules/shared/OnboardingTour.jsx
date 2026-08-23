import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// steps: [{ icon: '🏠', title: '...', description: '...' }]
// storageKey: localStorage key so it only auto-shows once per person
// forceOpen: pass `true` (e.g. from a "Help" button) to reopen on demand
export default function OnboardingTour({ steps, storageKey, forceOpen, onClose }) {
  const [open, setOpen] = useState(!localStorage.getItem(storageKey))
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (forceOpen) {
      setIndex(0)
      setOpen(true)
    }
  }, [forceOpen])

  function finish() {
    localStorage.setItem(storageKey, '1')
    setOpen(false)
    setIndex(0)
    onClose && onClose()
  }

  function next() {
    if (index === steps.length - 1) {
      finish()
      return
    }
    setDirection(1)
    setIndex((i) => i + 1)
  }

  function back() {
    setDirection(-1)
    setIndex((i) => Math.max(0, i - 1))
  }

  if (!open) return null

  const step = steps[index]

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-paper-raised rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        >
          <div className="bg-gradient-to-br from-brand to-brand-dark px-6 pt-8 pb-10 text-center relative overflow-hidden">
            <motion.div
              key={index}
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              className="text-5xl"
            >
              {step.icon}
            </motion.div>
            <button
              onClick={finish}
              className="absolute top-3 right-4 text-white/70 hover:text-white text-sm"
            >
              Skip
            </button>
          </div>

          <div className="px-6 pt-5 pb-6 overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={index}
                custom={direction}
                initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <h3 className="text-lg font-semibold text-ink text-center">{step.title}</h3>
                <p className="text-sm text-ink-soft text-center mt-2 leading-relaxed">{step.description}</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-1.5 mt-6">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-6 bg-brand' : 'w-1.5 bg-brass/20'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              {index > 0 && (
                <button onClick={back} className="flex-1 bg-paper text-ink-soft py-2.5 rounded-xl text-sm font-medium">
                  Back
                </button>
              )}
              <button onClick={next} className="flex-1 bg-brand hover:bg-brand-dark text-white py-2.5 rounded-xl text-sm font-medium transition">
                {index === steps.length - 1 ? "Let's go" : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
