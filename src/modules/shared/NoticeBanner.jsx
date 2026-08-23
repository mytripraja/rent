// notice.type: 'water' | 'eb' | 'both' | 'urgent' | 'general' | 'other'
// Water/EB colors are functional (tenants learn to recognize them at a glance),
// so those stay blue/yellow as designed. Urgent/general/other are restyled to
// sit inside the ledger palette for cohesion with the rest of the app.
const STYLE_MAP = {
  water: { background: '#dbeafe', color: '#1e40af', label: 'Water Notice' },
  eb: { background: '#fef9c3', color: '#854d0e', label: 'EB Notice' },
  urgent: { background: '#f3dede', color: '#a63a32', label: 'Urgent' },
  general: { background: '#fbf8ef', color: '#2b2620', label: 'Notice' },
  other: { background: '#efe9d8', color: '#6b6255', label: 'Notice' },
}

export default function NoticeBanner({ notice }) {
  if (notice.type === 'both') {
    return (
      <div
        className="rounded-xl p-4 mb-3 shadow-sm border border-brass/20"
        style={{ background: 'linear-gradient(90deg, #dbeafe 50%, #fef9c3 50%)', color: '#1f2937' }}
      >
        <p className="font-mono-tab text-xs font-semibold uppercase tracking-wide mb-1">Water &amp; EB Notice</p>
        <p className="text-sm">{notice.message}</p>
        {notice.windowText && <p className="text-xs mt-1 opacity-70">{notice.windowText}</p>}
      </div>
    )
  }

  const style = STYLE_MAP[notice.type] || STYLE_MAP.other

  return (
    <div
      className="rounded-xl p-4 mb-3 shadow-sm border border-brass/20"
      style={{ background: style.background, color: style.color }}
    >
      <p className="font-mono-tab text-xs font-semibold uppercase tracking-wide mb-1">{style.label}</p>
      <p className="text-sm">{notice.message}</p>
      {notice.windowText && <p className="text-xs mt-1 opacity-70">{notice.windowText}</p>}
    </div>
  )
}
