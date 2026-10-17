export default function LoadingScreen({ label = 'Loading Rental Manager…' }) {
  return (
    <div
      className="relative min-h-[100dvh] bg-paper flex flex-col items-center justify-center gap-6 p-6 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* soft ambient glow behind the loader */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(15,118,110,.13), transparent 62%)' }} />
      </div>

      <div className="rm-anim-float" aria-hidden="true">
        <div className="rm-loading-orbit">
          <div className="rm-cube-stage">
            <div className="rm-cube">
              <span /><span /><span /><span /><span /><span />
            </div>
          </div>
          <i /><i /><i />
        </div>
      </div>

      <div className="text-center">
        <p className="font-display text-lg font-extrabold text-ink">Rental Manager</p>
        <p className="font-mono-tab text-xs text-ink-soft uppercase tracking-wide mt-1">{label}</p>
        <div className="rm-dots mt-3 justify-center" aria-hidden="true"><i /><i /><i /></div>
        <span className="sr-only">Loading, please wait.</span>
      </div>
    </div>
  )
}
