import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Home, Info, Zap } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { formatDateOnly, formatDateTime } from '../../services/announcementShareService'
import LoadingScreen from '../shared/LoadingScreen'

export default function PublicNotice() {
  const { noticeId } = useParams()
  const [searchParams] = useSearchParams()
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch(`/api/rental?route=public-notice&id=${encodeURIComponent(noticeId || '')}&token=${encodeURIComponent(searchParams.get('token') || '')}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async r => {
        const contentType = r.headers.get('content-type') || ''
        const raw = await r.text()
        let data = null
        try { data = raw ? JSON.parse(raw) : null } catch {
          throw new Error(contentType.includes('text/html') ? 'Announcement service is unavailable. Please try again after the latest deployment.' : 'Invalid announcement response')
        }
        if (!r.ok) throw new Error(data?.error || 'Announcement not found')
        return data
      })
      .then(data => alive && setNotice(data.notice))
      .catch(err => alive && setError(err.message || 'Announcement not found'))
    return () => { alive = false }
  }, [noticeId, searchParams])

  if (!notice && !error) return <LoadingScreen />
  if (error) return <main className="min-h-screen bg-paper grid place-items-center p-6"><div className="rm-card p-6 max-w-md text-center"><AlertTriangle className="mx-auto text-stamp-amber"/><h1 className="font-semibold text-ink mt-3">Announcement unavailable</h1><p className="text-sm text-ink-soft mt-2">{error}</p></div></main>

  const resolved = !!notice.resolvedAt || notice.status === 'resolved'
  const affected = notice.affectedHomes || []
  return <main className="min-h-screen bg-paper text-ink p-4 sm:p-8">
    <article className="max-w-2xl mx-auto bg-paper-raised rounded-3xl border border-brass/20 shadow-xl overflow-hidden">
      <div className="bg-cover text-paper p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[.18em] text-brass-light font-semibold">Rental Manager · Announcement</p>
        <h1 className="font-display text-2xl sm:text-4xl mt-2">{notice.title || notice.message}</h1>{notice.titleTamil && <p className="font-display text-xl sm:text-2xl mt-2 text-paper/90" lang="ta">{notice.titleTamil}</p>}
        <p className="text-sm text-paper/70 mt-2">{resolved ? 'Resolved / தீர்வு காணப்பட்டது' : 'Active announcement / செயலில் உள்ள அறிவிப்பு'}</p>
      </div>
      <div className="p-6 sm:p-8 space-y-5">
        <div className={`rounded-2xl p-4 border ${resolved ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}><div className="flex gap-3">{resolved ? <CheckCircle2 className="text-green-700 shrink-0"/> : <Zap className="text-amber-700 shrink-0"/>}<div><p className="font-semibold text-sm">{notice.category || 'Property update'}{notice.categoryTamil && <span lang="ta"> / {notice.categoryTamil}</span>}</p><p className="text-sm mt-1">{notice.message}</p>{notice.messageTamil && <p className="text-sm mt-3 pt-3 border-t border-amber-200/70" lang="ta">{notice.messageTamil}</p>}</div></div></div>
        {notice.createdAt && <InfoRow icon={CalendarClock} label="Created / உருவாக்கப்பட்ட தேதி" value={formatDateTime(notice.createdAt)} />}
        {affected.length > 0 && <InfoRow icon={Home} label="Affected house(s)" value={affected.join(', ')} />}
        {notice.happenedAt && <InfoRow icon={CalendarClock} label="Started" value={notice.showTimeDetails === false ? formatDateOnly(notice.happenedAt) : formatDateTime(notice.happenedAt)} />}
        {notice.expectedResolutionAt && <InfoRow icon={CalendarClock} label="Expected resolution" value={notice.showTimeDetails === false ? formatDateOnly(notice.expectedResolutionAt) : formatDateTime(notice.expectedResolutionAt)} />}
        {notice.resolvedAt && <InfoRow icon={CheckCircle2} label="Resolved" value={notice.showTimeDetails === false ? formatDateOnly(notice.resolvedAt) : formatDateTime(notice.resolvedAt)} />}
        {notice.reason && <InfoRow icon={Info} label="Reason / காரணம்" value={notice.reasonTamil ? `${notice.reason} / ${notice.reasonTamil}` : notice.reason} />}
        {notice.additionalDetails && <div><h2 className="text-sm font-semibold">Additional details / கூடுதல் விவரங்கள்</h2><p className="text-sm text-ink-soft whitespace-pre-wrap mt-2">{notice.additionalDetails}</p>{notice.additionalDetailsTamil && <p className="text-sm text-ink-soft whitespace-pre-wrap mt-3 pt-3 border-t border-brass/15" lang="ta">{notice.additionalDetailsTamil}</p>}</div>}
        {notice.imageUrl && <img src={notice.imageUrl} alt="Announcement" className="w-full rounded-2xl border border-brass/20" />}
        {Array.isArray(notice.linkedAnnouncements) && notice.linkedAnnouncements.length > 0 && <section className="pt-5 border-t border-brass/15"><h2 className="text-sm font-semibold">Related announcements / தொடர்புடைய அறிவிப்புகள்</h2><p className="text-xs text-ink-soft mt-1">Other notices connected to this issue.</p><div className="mt-3 grid gap-2">{notice.linkedAnnouncements.map(item=><a key={item.id} href={item.shareUrl} className="rounded-xl border border-brass/15 bg-paper p-3 hover:border-brand/30 hover:bg-brand/5 transition"><span className="text-xs font-bold text-brand">{item.category}</span><p className="text-sm font-semibold mt-1">{item.title}</p>{item.titleTamil&&<p className="text-xs text-ink-soft mt-1" lang="ta">{item.titleTamil}</p>}<p className="text-xs text-ink-soft mt-1 line-clamp-2">{item.message}</p>{item.messageTamil&&<p className="text-xs text-ink-soft mt-1 line-clamp-2" lang="ta">{item.messageTamil}</p>}</a>)}</div></section>}
        {Array.isArray(notice.previousUpdates) && notice.previousUpdates.length > 0 && <section className="pt-5 border-t border-brass/15"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Previous updates / முந்தைய புதுப்பிப்புகள்</h2><p className="text-xs text-ink-soft mt-1">This announcement continues the same issue.</p></div><span className="text-xs font-semibold text-brand">{notice.updateNumber ? `Update #${notice.updateNumber}` : 'Update'}</span></div><div className="mt-3 space-y-2">{notice.previousUpdates.map((u, index) => <a key={u.id} href={u.shareUrl} className="block rounded-xl border border-brass/15 bg-paper p-3 hover:border-brand/30 hover:bg-brand/5 transition"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-brand">{u.continuationLabel || `Update #${u.updateNumber || (notice.previousUpdates.length - index)}`}</span><span className="text-xs text-ink-soft">Open ↗</span></div><p className="text-sm font-semibold mt-1">{u.title}</p>{u.titleTamil && <p className="text-xs text-ink-soft mt-1" lang="ta">{u.titleTamil}</p>}<p className="text-xs text-ink-soft mt-1 line-clamp-2">{u.message}</p>{u.messageTamil && <p className="text-xs text-ink-soft mt-1 line-clamp-2" lang="ta">{u.messageTamil}</p>}</a>)}</div></section>}
        <p className="text-xs text-ink-soft pt-3 border-t border-brass/15">Shared announcement / பகிரப்பட்ட அறிவிப்பு. English and Tamil versions are shown above. / மேலே ஆங்கிலம் மற்றும் தமிழ் பதிப்புகள் காட்டப்பட்டுள்ளன.</p>
      </div>
    </article>
  </main>
}

function InfoRow({ icon: Icon, label, value }) { return <div className="flex gap-3 items-start"><Icon size={18} className="text-brand mt-0.5 shrink-0"/><div><p className="text-[11px] uppercase tracking-wide text-ink-soft">{label}</p><p className="text-sm font-medium mt-0.5">{value}</p></div></div> }
