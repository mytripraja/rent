export default function LoadingScreen({ label = 'Loading your ledger…' }) {
  return (
    <div
      className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="loading-stamp w-16 h-16 rounded-lg border-2 border-cover flex items-center justify-center">
        <span className="font-display text-2xl text-cover">RM</span>
      </div>
      <p className="font-mono-tab text-xs text-ink-soft uppercase tracking-wide">{label}</p>
      <span className="sr-only">Loading, please wait.</span>
    </div>
  )
}
