import { useEffect, useState } from 'react'
import { Megaphone, Share2, Trash2, GitBranch, Link2, Search, X, CalendarDays, Clock3 } from 'lucide-react'
import { listHouses } from '../../services/houseService'
import { createNotice, listAllNoticesForHouses, deleteNotice, ensureNoticePublicShare, linkNotices } from '../../services/noticeService'
import { getTemplates } from '../../services/configService'
import NoticeBanner from '../shared/NoticeBanner'
import NoticeShareModal from './NoticeShareModal'
import ConfirmDialog from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { translateAnnouncementFields } from '../../services/announcementTranslationService'

const TYPES = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'eb', label: 'EB / power' },
  { id: 'water', label: 'Water' },
  { id: 'both', label: 'Water + EB' },
  { id: 'general', label: 'General' },
  { id: 'other', label: 'Other' },
]

const blankForm = {
  type: 'urgent', title: '', category: 'Power cut', message: '', windowText: '', durationHours: '',
  audience: 'all', selectedHouseIds: [], isScheduled: false, scheduledDate: '', scheduledTime: '',
  happenedAt: '', expectedResolutionAt: '', resolvedAt: '', showTimeDetails: true, reason: '', additionalDetails: '', imageFile: null,
  titleTamil: '', messageTamil: '', categoryTamil: '', reasonTamil: '', additionalDetailsTamil: '', tamilManual: false,
  parentNoticeId: '', continuationLabel: 'Update', linkedNoticeIds: [],
}

export default function NoticeManager() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [houses, setHouses] = useState([])
  const [notices, setNotices] = useState([])
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [shareNotice, setShareNotice] = useState(null)
  const [linkingNotice, setLinkingNotice] = useState(null)
  const [detailNotice, setDetailNotice] = useState(null)
  const [noticeSearch, setNoticeSearch] = useState('')

  useEffect(() => { refresh() }, [])

  async function refresh() {
    const propertyHouses = await listHouses()
    setHouses(propertyHouses)
    const [noticeRows, templateRows] = await Promise.all([
      listAllNoticesForHouses(propertyHouses.map(h => h.id), propertyHouses[0]?.propertyId || null),
      getTemplates(),
    ])
    setNotices(noticeRows)
    setTemplates(templateRows)
  }

  function toggleHouse(houseId) {
    setForm(f => ({ ...f, selectedHouseIds: f.selectedHouseIds.includes(houseId) ? f.selectedHouseIds.filter(id => id !== houseId) : [...f.selectedHouseIds, houseId] }))
  }

  function handleTemplateSelect(e) {
    const template = templates.find(t => t.id === e.target.value)
    if (!template) return
    const body = template.body || ''
    let type = 'general'
    if (/water/i.test(body)) type = 'water'
    else if (/eb|power/i.test(body)) type = 'eb'
    const next = { ...form, message: body, title: template.title || '', type }
    const translated = translateAnnouncementFields(next)
    setForm(f => ({ ...f, ...next, ...translated, tamilManual: false }))
  }


  function updateEnglishField(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (!f.tamilManual && ['title', 'message', 'category', 'reason', 'additionalDetails'].includes(field)) {
        const translated = translateAnnouncementFields({ ...next })
        next.titleTamil = translated.titleTamil
        next.messageTamil = translated.messageTamil
        next.categoryTamil = translated.categoryTamil
        next.reasonTamil = translated.reasonTamil
        next.additionalDetailsTamil = translated.additionalDetailsTamil
      }
      return next
    })
  }

  function regenerateTamil() {
    const translated = translateAnnouncementFields(form)
    setForm(f => ({ ...f, ...translated, tamilManual: false }))
  }


  function continueNotice(notice) {
    const nextNumber = Number(notice.updateNumber || 1) + 1
    const next = {
      ...blankForm,
      type: notice.type || 'general',
      title: `Update: ${notice.title || 'Announcement'}`,
      category: notice.category || 'Update',
      message: '',
      reason: '',
      additionalDetails: '',
      audience: notice.targetHouseIds === 'all' ? 'all' : 'select',
      selectedHouseIds: Array.isArray(notice.targetHouseIds) ? [...notice.targetHouseIds] : [],
      linkedNoticeIds: Array.isArray(notice.linkedNoticeIds) ? [...notice.linkedNoticeIds] : [],
      showTimeDetails: notice.showTimeDetails !== false,
      parentNoticeId: notice.id,
      continuationLabel: `Update #${nextNumber}`,
    }
    const translated = translateAnnouncementFields(next)
    setForm(f => ({ ...f, ...next, ...translated, tamilManual: false }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showToast({ message: `Continuing “${notice.title || 'announcement'}” as Update #${nextNumber}`, type: 'success' })
  }


  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) return showToast({ message: 'Add a title and message.', type: 'error' })
    if (form.audience === 'select' && form.selectedHouseIds.length === 0) return showToast({ message: 'Please select at least one house.', type: 'error' })
    const happenedMs = form.happenedAt ? new Date(form.happenedAt).getTime() : null
    const expectedMs = form.expectedResolutionAt ? new Date(form.expectedResolutionAt).getTime() : null
    const resolvedMs = form.resolvedAt ? new Date(form.resolvedAt).getTime() : null
    if (happenedMs && expectedMs && expectedMs < happenedMs) return showToast({ message: 'Expected resolution cannot be before Started / happened.', type: 'error' })
    if (happenedMs && resolvedMs && resolvedMs < happenedMs) return showToast({ message: 'Resolved at cannot be before Started / happened.', type: 'error' })
    let scheduledAt = null
    if (form.isScheduled && form.scheduledDate && form.scheduledTime) {
      scheduledAt = new Date(`${form.scheduledDate}T${form.scheduledTime}`).getTime()
      if (scheduledAt <= Date.now()) return showToast({ message: 'Scheduled time must be in the future.', type: 'error' })
    }
    setSaving(true)
    try {
      const targetHouseIds = form.audience === 'all' ? 'all' : form.selectedHouseIds
      const result = await createNotice({
        type: form.type, title: form.title, category: form.category, message: form.message,
        windowText: form.windowText, durationHours: form.durationHours ? Number(form.durationHours) : null,
        targetHouseIds, createdBy: { uid: user?.uid, name: user?.name }, propertyId: houses[0]?.propertyId || 'default', scheduledAt,
        happenedAt: form.happenedAt ? new Date(form.happenedAt).getTime() : null,
        expectedResolutionAt: form.expectedResolutionAt ? new Date(form.expectedResolutionAt).getTime() : null,
        resolvedAt: form.resolvedAt ? new Date(form.resolvedAt).getTime() : null,
        showTimeDetails: !!form.showTimeDetails,
        reason: form.reason, additionalDetails: form.additionalDetails, imageFile: form.imageFile,
        titleTamil: form.titleTamil, messageTamil: form.messageTamil, categoryTamil: form.categoryTamil,
        reasonTamil: form.reasonTamil, additionalDetailsTamil: form.additionalDetailsTamil,
        parentNoticeId: form.parentNoticeId || null,
        updateNumber: form.parentNoticeId ? (Number(notices.find(n => n.id === form.parentNoticeId)?.updateNumber || 1) + 1) : null,
        continuationLabel: form.parentNoticeId ? (form.continuationLabel || 'Update') : null,
        notificationHouses: houses,
      })
      if (form.linkedNoticeIds.length) await linkNotices(result.id, form.linkedNoticeIds)
      const selectedHomes = targetHouseIds === 'all' ? [] : houses.filter(h => Array.isArray(targetHouseIds) && targetHouseIds.includes(h.id)).map(h => h.internalDoorNumber).filter(Boolean)
      setForm(blankForm)
      showToast({ message: 'Announcement posted successfully', type: 'success' })
      setShareNotice({ id: result.id, ...form, targetHouseIds, imageUrl: result.imageUrl, shareUrl: result.shareUrl, updateNumber: result.updateNumber, continuationLabel: result.continuationLabel, affectedHomes: selectedHomes })
      refresh()
    } catch (err) {
      showToast({ message: 'Failed to post announcement: ' + err.message, type: 'error' })
    } finally { setSaving(false) }
  }

  async function performDelete() {
    if (!deletingId) return
    try { await deleteNotice(deletingId); showToast({ message: 'Notice deleted successfully', type: 'success' }); refresh() }
    catch (err) { showToast({ message: 'Failed to delete notice: ' + err.message, type: 'error' }) }
    finally { setDeletingId(null) }
  }

  const now = Date.now()
  async function openShare(n) {
    try {
      const shared = await ensureNoticePublicShare(n.id)
      const homes = shared.targetHouseIds === 'all' ? [] : houses.filter(h => Array.isArray(shared.targetHouseIds) && shared.targetHouseIds.includes(h.id)).map(h => h.internalDoorNumber).filter(Boolean)
      setShareNotice({ ...shared, affectedHomes: homes })
    } catch (err) {
      showToast({ message: err.message || 'Could not prepare share link', type: 'error' })
    }
  }

  return <div className="space-y-8">
    <div>
      <h2 className="text-lg font-semibold text-ink">Announcements & notices</h2>
      <p className="text-sm text-ink-soft">Create a normal notice or a detailed incident update. You can target only selected houses or all houses.</p>
    </div>

    <form onSubmit={submit} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 sm:p-5 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-brand"><Megaphone size={18}/><span className="text-sm font-bold">Create announcement</span></div>
      {templates.length > 0 && <select onChange={handleTemplateSelect} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"><option value="">Use a template (optional)</option>{templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}

      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="Title — e.g. Power cut in G1 & F3" value={form.title} onChange={e => updateEnglishField('title', e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Category — e.g. Power cut" value={form.category} onChange={e => updateEnglishField('category', e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      </div>
      <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">{TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-ink"><GitBranch size={16} className="text-brand"/> Continue a previous announcement</div><select value={form.parentNoticeId} onChange={e => { const id=e.target.value; const parent=notices.find(n=>n.id===id); setForm(f => ({...f,parentNoticeId:id,continuationLabel:id ? `Update #${Number(parent?.updateNumber||1)+1}` : 'Update'}))}} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm bg-paper"><option value="">New announcement (no link)</option>{notices.slice(0,40).map(n=><option key={n.id} value={n.id}>{n.updateNumber ? `#${n.updateNumber} · ` : ''}{n.title || n.message?.slice(0,60)}</option>)}</select>{form.parentNoticeId && <p className="text-[11px] text-ink-soft">This announcement will be shown as {form.continuationLabel} and linked to the previous announcement on the public page.</p>}</div>
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-semibold text-ink"><Link2 size={16} className="text-brand"/> Link related announcements</div><p className="text-[11px] text-ink-soft">Connect different announcements such as EB → water. These links are separate from the Update chain and can be changed or removed later.</p><div className="flex flex-wrap gap-2 max-h-28 overflow-auto">{notices.filter(n=>n.id!==form.parentNoticeId).slice(0,40).map(n => { const checked=Array.isArray(form.linkedNoticeIds) && form.linkedNoticeIds.includes(n.id); return <button type="button" key={n.id} onClick={()=>setForm(f=>({...f,linkedNoticeIds:checked?f.linkedNoticeIds.filter(id=>id!==n.id):[...f.linkedNoticeIds,n.id]}))} className={`text-xs px-3 py-1.5 rounded-full border ${checked?'bg-brand text-white border-brand':'bg-paper-raised text-ink-soft border-brass/30'}`}>{checked?'✓ ':''}{n.title||n.message?.slice(0,45)}</button> })}</div></div>
      <textarea required rows={3} placeholder="What happened?" value={form.message} onChange={e => updateEnglishField('message', e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      <div className="rounded-xl border border-brass/20 bg-paper p-3 space-y-3">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-ink">Tamil translation</p><p className="text-[11px] text-ink-soft">Auto-generated draft. You can edit it before saving.</p></div><button type="button" onClick={regenerateTamil} className="text-xs font-semibold text-brand hover:underline">Regenerate Tamil</button></div>
        <input placeholder="Tamil title" value={form.titleTamil} onChange={e => setForm({...form,titleTamil:e.target.value,tamilManual:true})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <textarea rows={3} placeholder="Tamil announcement" value={form.messageTamil} onChange={e => setForm({...form,messageTamil:e.target.value,tamilManual:true})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Tamil category" value={form.categoryTamil} onChange={e => setForm({...form,categoryTamil:e.target.value,tamilManual:true})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <textarea rows={2} placeholder="Tamil reason (optional)" value={form.reasonTamil} onChange={e => setForm({...form,reasonTamil:e.target.value,tamilManual:true})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
        <textarea rows={2} placeholder="Tamil additional details (optional)" value={form.additionalDetailsTamil} onChange={e => setForm({...form,additionalDetailsTamil:e.target.value,tamilManual:true})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="rounded-2xl border border-[var(--rm-border)] bg-paper p-3 space-y-3">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-ink">Date & time</p><p className="text-[11px] text-ink-soft">Add timing when useful. You can publish the announcement without showing a time.</p></div><label className="flex items-center gap-2 text-xs font-semibold text-ink"><input type="checkbox" checked={form.showTimeDetails} onChange={e=>setForm({...form,showTimeDetails:e.target.checked})}/> Show time</label></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-ink-soft">Started / happened<input type="datetime-local" value={form.happenedAt} onChange={e => setForm({...form,happenedAt:e.target.value})} className="block w-full border border-brass/30 rounded-lg px-3 py-2 text-sm text-ink mt-1" /></label>
          <label className="text-xs text-ink-soft">Expected resolution<input type="datetime-local" value={form.expectedResolutionAt} onChange={e => setForm({...form,expectedResolutionAt:e.target.value})} className="block w-full border border-brass/30 rounded-lg px-3 py-2 text-sm text-ink mt-1" /></label>
          <label className="text-xs text-ink-soft">Resolved at (optional)<input type="datetime-local" value={form.resolvedAt} onChange={e => setForm({...form,resolvedAt:e.target.value})} className="block w-full border border-brass/30 rounded-lg px-3 py-2 text-sm text-ink mt-1" /></label>
        </div>
      </div>
      <input placeholder="Reason / cause (optional)" value={form.reason} onChange={e => updateEnglishField('reason', e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      <textarea rows={3} placeholder="Additional details, safety notes, alternative arrangements, what is being done to solve it…" value={form.additionalDetails} onChange={e => updateEnglishField('additionalDetails', e.target.value)} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      <input type="file" accept="image/*" onChange={e => setForm({...form,imageFile:e.target.files?.[0] || null})} className="w-full text-sm" />

      <div className="border border-brass/20 p-3 rounded-xl bg-paper space-y-2">
        <p className="text-xs font-bold text-ink">Who should see it?</p>
        <div className="flex gap-4 text-sm"><label className="flex items-center gap-1.5"><input type="radio" checked={form.audience==='all'} onChange={() => setForm({...form,audience:'all'})}/> All houses</label><label className="flex items-center gap-1.5"><input type="radio" checked={form.audience==='select'} onChange={() => setForm({...form,audience:'select'})}/> Only selected houses</label></div>
        {form.audience === 'select' && <div className="flex flex-wrap gap-2 pt-1">{houses.map(h => <button type="button" key={h.id} onClick={() => toggleHouse(h.id)} className={`text-xs px-3 py-1.5 rounded-full border ${form.selectedHouseIds.includes(h.id) ? 'bg-brand text-white border-brand' : 'bg-paper-raised text-ink-soft border-brass/30'}`}>{h.internalDoorNumber}</button>)}</div>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3"><input placeholder="Time window (e.g. 10 AM – 2 PM)" value={form.windowText} onChange={e => setForm({...form,windowText:e.target.value})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" /><input type="number" min="1" placeholder="Auto-expire after hours" value={form.durationHours} onChange={e => setForm({...form,durationHours:e.target.value})} className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" /></div>
      <div className="border border-brass/20 p-3 rounded-xl bg-paper"><label className="flex items-center gap-2 text-sm font-medium text-ink"><input type="checkbox" checked={form.isScheduled} onChange={e => setForm({...form,isScheduled:e.target.checked})}/> Schedule for later</label>{form.isScheduled && <div className="flex gap-2 mt-2"><input type="date" required value={form.scheduledDate} onChange={e => setForm({...form,scheduledDate:e.target.value})} className="flex-1 border border-brass/30 rounded-lg px-3 py-2 text-sm"/><input type="time" required value={form.scheduledTime} onChange={e => setForm({...form,scheduledTime:e.target.value})} className="flex-1 border border-brass/30 rounded-lg px-3 py-2 text-sm"/></div>}</div>
      <button disabled={saving} className="w-full bg-brand text-white py-3 rounded-xl text-sm font-bold disabled:opacity-60">{saving ? 'Posting…' : 'Create & post announcement'}</button>
    </form>

    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3 max-w-4xl"><div><h3 className="text-sm font-semibold text-ink">All notices</h3><p className="text-xs text-ink-soft mt-1">Search by title, content, category, or date. Click Details to see the complete record.</p></div><label className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"/><input value={noticeSearch} onChange={e=>setNoticeSearch(e.target.value)} placeholder="Search title, content, 2026, 30-09-2026…" className="w-full border border-[var(--rm-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm bg-paper"/></label></div>
      <div className="space-y-3 max-w-4xl">{notices.filter(n=>matchesNoticeSearch(n,noticeSearch)).map(n => { const expired=n.expiresAt&&n.expiresAt<=now; const scheduled=n.scheduledAt&&n.scheduledAt>now; return <div key={n.id} className={expired?'opacity-40':''}><NoticeBanner notice={n}/><div className="flex flex-wrap items-center justify-between gap-2 -mt-1 mb-3 px-1"><span className="text-xs text-ink-soft">Created {n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'): '—'} · {expired?'Expired':scheduled?`Scheduled for ${new Date(n.scheduledAt).toLocaleString('en-IN')}`:n.status==='resolved'?'Resolved':'Active'} · {n.targetHouseIds==='all'?'All houses':`${n.targetHouseIds?.length || 0} house(s)`}</span><div className="flex flex-wrap gap-3"><button onClick={() => setDetailNotice(n)} className="text-xs text-brand hover:underline flex items-center gap-1"><CalendarDays size={14}/> Details</button><button onClick={() => continueNotice(n)} className="text-xs text-brand hover:underline flex items-center gap-1"><GitBranch size={14}/> Continue</button><button onClick={() => setLinkingNotice(n)} className="text-xs text-brand hover:underline flex items-center gap-1"><Link2 size={14}/> Links</button><button onClick={() => openShare(n)} className="text-xs text-brand hover:underline flex items-center gap-1"><Share2 size={14}/> Share</button><button onClick={() => setDeletingId(n.id)} className="text-xs text-red-600 hover:underline flex items-center gap-1"><Trash2 size={14}/> Delete</button></div></div></div>})}{notices.length===0&&<p className="text-sm text-ink-soft">No notices yet.</p>}{notices.length>0&&notices.filter(n=>matchesNoticeSearch(n,noticeSearch)).length===0&&<p className="text-sm text-ink-soft py-6 text-center">No notices match your search.</p>}</div></div>

    {detailNotice && <NoticeDetailModal notice={detailNotice} onClose={()=>setDetailNotice(null)} />}
    {linkingNotice && <NoticeLinkEditor notice={linkingNotice} notices={notices} onClose={()=>setLinkingNotice(null)} onSaved={refresh} />}
    {shareNotice && <NoticeShareModal notice={shareNotice} affectedHomes={shareNotice.affectedHomes || []} onClose={() => setShareNotice(null)} />}
    <ConfirmDialog isOpen={!!deletingId} title="Delete Notice" message="Are you sure you want to delete this notice?" onConfirm={performDelete} onCancel={() => setDeletingId(null)} confirmText="Delete" danger />
  </div>
}


function matchesNoticeSearch(notice, rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase()
  if (!q) return true
  // Search every meaningful announcement timestamp, not only when it was created.
  // This lets owners find an incident by its start, expected resolution, or resolution date.
  const timestampFields = ['createdAt', 'happenedAt', 'expectedResolutionAt', 'resolvedAt']
  const dateParts = timestampFields.flatMap(field => {
    const raw = notice[field]
    if (raw === null || raw === undefined || raw === '') return []
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return []
    return [
      date.toLocaleDateString('en-IN'),
      date.toISOString().slice(0, 10),
      String(date.getFullYear()),
      String(date.getDate()),
      String(date.getDate()).padStart(2, '0'),
      date.toLocaleDateString('en-IN', { weekday: 'long' }),
      date.toLocaleDateString('en-IN', { month: 'long' }),
      date.toLocaleDateString('en-IN', { month: 'short' }),
    ]
  }).join(' ').toLowerCase()
  const haystack = [notice.title, notice.titleTamil, notice.message, notice.messageTamil, notice.category, notice.reason, notice.additionalDetails, dateParts].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

function NoticeDetailModal({ notice, onClose }) {
  const date = notice.createdAt ? new Date(notice.createdAt) : null
  const row = (label, value) => value ? <div className="rounded-xl border border-[var(--rm-border)] bg-paper p-3"><p className="text-[11px] uppercase tracking-wide text-ink-soft font-bold">{label}</p><p className="text-sm text-ink mt-1 whitespace-pre-wrap">{value}</p></div> : null
  return <div className="fixed inset-0 z-[95] bg-black/50 p-3 sm:p-6 grid place-items-center" role="dialog" aria-modal="true"><div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-paper-raised border border-[var(--rm-border)] shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-paper-raised/95 backdrop-blur border-b border-[var(--rm-border)]"><div><p className="text-[10px] uppercase tracking-[.18em] text-brand font-bold">Announcement details</p><h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink mt-1">{notice.title || 'Announcement'}</h2>{notice.titleTamil&&<p lang="ta" className="text-sm text-ink-soft mt-1">{notice.titleTamil}</p>}<p className="text-xs text-ink-soft mt-2">Created {date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-IN') : '—'}</p></div><button onClick={onClose} className="w-10 h-10 rounded-xl border border-[var(--rm-border)] grid place-items-center" aria-label="Close"><X size={18}/></button></div><div className="p-5 space-y-3">{row('Status', notice.status || 'active')}{row('Category', notice.categoryTamil ? `${notice.category || '—'} / ${notice.categoryTamil}` : notice.category || notice.type || '—')}{row('Message', notice.message)}{row('Tamil message', notice.messageTamil)}{row('Reason / cause', notice.reasonTamil ? `${notice.reason || '—'} / ${notice.reasonTamil}` : notice.reason)}{row('Additional details', notice.additionalDetails)}{row('Tamil additional details', notice.additionalDetailsTamil)}{row('Started / happened', notice.happenedAt ? new Date(notice.happenedAt).toLocaleString('en-IN') : null)}{row('Expected resolution', notice.expectedResolutionAt ? new Date(notice.expectedResolutionAt).toLocaleString('en-IN') : null)}{row('Resolved at', notice.resolvedAt ? new Date(notice.resolvedAt).toLocaleString('en-IN') : null)}{row('Audience', notice.targetHouseIds === 'all' ? 'All houses' : `${notice.targetHouseIds?.length || 0} selected house(s)`)}{notice.parentNoticeId && row('Continues from', notice.continuationLabel || `Update #${notice.updateNumber || ''}`)}{Array.isArray(notice.linkedNoticeIds)&&notice.linkedNoticeIds.length>0&&row('Linked announcements', `${notice.linkedNoticeIds.length} linked announcement(s)`)}{notice.imageUrl&&<img src={notice.imageUrl} alt="Announcement attachment" className="w-full max-h-80 object-contain rounded-2xl border border-[var(--rm-border)]"/>}<div className="flex justify-end pt-2"><button onClick={onClose} className="rm-secondary-button px-4 py-2">Close</button></div></div></div></div>
}


function NoticeLinkEditor({ notice, notices, onClose, onSaved }) {
  const { showToast } = useToast()
  const [selected, setSelected] = useState(Array.isArray(notice.linkedNoticeIds) ? notice.linkedNoticeIds : [])
  const [saving, setSaving] = useState(false)
  async function save() { setSaving(true); try { await linkNotices(notice.id, selected); showToast({message:selected.length?'Announcement links updated.':'All links disconnected.',type:'success'}); await onSaved(); onClose() } catch(e) { showToast({message:e.message||'Could not update links.',type:'error'}) } finally { setSaving(false) } }
  return <div className="fixed inset-0 z-[90] bg-black/50 p-4 grid place-items-center"><div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl bg-paper-raised border border-brass/20 shadow-2xl p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-ink">Related announcements</h3><p className="text-xs text-ink-soft mt-1">Link or disconnect any announcements in this property. Update-chain links remain separate.</p></div><button onClick={onClose} className="text-ink-soft">×</button></div><div className="mt-4 space-y-2">{notices.filter(n=>n.id!==notice.id).map(n=>{const checked=selected.includes(n.id);return <label key={n.id} className="flex items-start gap-3 rounded-xl border border-[var(--rm-border)] p-3 cursor-pointer"><input type="checkbox" checked={checked} onChange={()=>setSelected(v=>checked?v.filter(id=>id!==n.id):[...v,n.id])} className="mt-1"/><span><b className="text-sm text-ink">{n.title||n.message?.slice(0,60)}</b><span className="block text-xs text-ink-soft mt-1">{n.category||n.type||'Notice'} · {n.createdAt?new Date(n.createdAt).toLocaleDateString('en-IN'):''}</span></span></label>})}</div><div className="mt-4 flex gap-2"><button disabled={saving} onClick={save} className="flex-1 rounded-xl bg-brand text-white py-2.5 text-sm font-bold">{saving?'Saving…':'Save links'}</button><button onClick={onClose} className="flex-1 rm-secondary-button justify-center">Cancel</button></div></div></div>
}
