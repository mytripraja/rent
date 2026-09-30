export default function LoadingScreen({ label = 'Loading Rental Manager…' }) {
  return <div className="min-h-[100dvh] bg-paper flex flex-col items-center justify-center gap-5 p-6" role="status" aria-live="polite" aria-busy="true">
    <div className="rm-loading-orbit" aria-hidden="true"><div className="rm-loading-core">RM</div><i/><i/><i/></div>
    <div className="text-center"><p className="font-display text-lg font-extrabold text-ink">Rental Manager</p><p className="font-mono-tab text-xs text-ink-soft uppercase tracking-wide mt-1">{label}</p><span className="sr-only">Loading, please wait.</span></div>
  </div>
}
