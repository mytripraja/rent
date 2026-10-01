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

export default function NoticeBanner({ notice, relatedNotices = [] }) {
  if (notice.type === 'both') {
    return (
      <div
        className="rounded-xl p-4 mb-3 shadow-sm border border-brass/20"
        style={{ background: 'linear-gradient(90deg, #dbeafe 50%, #fef9c3 50%)', color: '#1f2937' }}
      >
        <p className="font-mono-tab text-xs font-semibold uppercase tracking-wide mb-1">Water &amp; EB Notice</p>
        {notice.title && <p className="font-semibold text-sm mb-1">{notice.title}{notice.updateNumber ? <span className="ml-2 text-[10px] opacity-70">{notice.continuationLabel || `Update #${notice.updateNumber}`}</span> : null}</p>}<p className="text-sm">{notice.message}</p>
        {notice.windowText && <p className="text-xs mt-1 opacity-70">{notice.windowText}</p>}
        {relatedNotices.length > 0 && <div className="mt-3 pt-2 border-t border-black/10 space-y-2"><p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Related notices</p>{relatedNotices.map(item => <div key={item.id} className="rounded-lg bg-white/50 px-3 py-2"><p className="text-xs font-semibold">{item.title || 'Related announcement'}</p><p className="text-xs mt-1 whitespace-pre-wrap">{item.message}</p>{item.messageTamil && <p lang="ta" className="text-xs mt-1 whitespace-pre-wrap">{item.messageTamil}</p>}</div>)}</div>}
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
      {notice.title && <p className="font-semibold text-sm mb-1">{notice.title}{notice.updateNumber ? <span className="ml-2 text-[10px] opacity-70">{notice.continuationLabel || `Update #${notice.updateNumber}`}</span> : null}</p>}<p className="text-sm">{notice.message}</p>
      {notice.windowText && <p className="text-xs mt-1 opacity-70">{notice.windowText}</p>}
      {relatedNotices.length > 0 && <div className="mt-3 pt-2 border-t border-black/10 space-y-2"><p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Related notices</p>{relatedNotices.map(item => <div key={item.id} className="rounded-lg bg-white/50 px-3 py-2"><p className="text-xs font-semibold">{item.title || 'Related announcement'}</p><p className="text-xs mt-1 whitespace-pre-wrap">{item.message}</p>{item.messageTamil && <p lang="ta" className="text-xs mt-1 whitespace-pre-wrap">{item.messageTamil}</p>}</div>)}</div>}
    </div>
  )
}
