// notice.type: 'water' | 'eb' | 'both' | 'urgent' | 'general' | 'other'
const STYLE_MAP = {
  water: { background: '#dbeafe', color: '#1e40af', label: 'Water Notice' },
  eb: { background: '#fef9c3', color: '#854d0e', label: 'EB Notice' },
  urgent: { background: '#fee2e2', color: '#991b1b', label: 'Urgent' },
  general: { background: '#ffffff', color: '#374151', label: 'Notice' },
  other: { background: '#f3f4f6', color: '#374151', label: 'Notice' },
}

export default function NoticeBanner({ notice }) {
  if (notice.type === 'both') {
    return (
      <div
        className="rounded-xl p-4 mb-3 shadow-sm border"
        style={{ background: 'linear-gradient(90deg, #dbeafe 50%, #fef9c3 50%)', color: '#1f2937' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide mb-1">Water &amp; EB Notice</p>
        <p className="text-sm">{notice.message}</p>
        {notice.windowText && <p className="text-xs mt-1 opacity-70">{notice.windowText}</p>}
      </div>
    )
  }

  const style = STYLE_MAP[notice.type] || STYLE_MAP.other

  return (
    <div
      className="rounded-xl p-4 mb-3 shadow-sm border"
      style={{ background: style.background, color: style.color }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide mb-1">{style.label}</p>
      <p className="text-sm">{notice.message}</p>
      {notice.windowText && <p className="text-xs mt-1 opacity-70">{notice.windowText}</p>}
    </div>
  )
}
