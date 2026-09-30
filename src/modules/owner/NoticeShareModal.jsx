import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { postMessage } from '../../services/communityService'
import { Copy, Download, Mail, MessageCircle, Share2, X } from 'lucide-react'
import { buildAnnouncementImage, buildAnnouncementPdf, buildAnnouncementText, shareAnnouncementFile, shareNative, shareViaEmail, shareViaWhatsApp } from '../../services/announcementShareService'
import { useToast } from '../shared/ui/Toast'

export default function NoticeShareModal({ notice, affectedHomes, onClose }) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [format, setFormat] = useState('text')
  const [postingToCommunity, setPostingToCommunity] = useState(false)
  const text = buildAnnouncementText(notice, affectedHomes)
  const title = notice.title || notice.message || 'Rental Manager announcement'

  async function copyText() {
    await navigator.clipboard.writeText(text)
    showToast({ message: 'Announcement copied', type: 'success' })
  }

  async function postToCommunity() {
    if (!notice.shareUrl || postingToCommunity) return
    setPostingToCommunity(true)
    try {
      const communityText = `📢 ${title}${notice.titleTamil ? ` / ${notice.titleTamil}` : ''}
${notice.message || ''}${notice.messageTamil ? `
${notice.messageTamil}` : ''}

Details / விவரங்கள்: ${notice.shareUrl}`
      await postMessage({ authorId: user?.uid, authorName: user?.name || 'Management', authorRole: user?.role || 'owner', houseId: null, text: communityText })
      showToast({ message: 'Announcement link posted to Community.', type: 'success' })
    } catch (err) {
      showToast({ message: err.message || 'Could not post to Community.', type: 'error' })
    } finally { setPostingToCommunity(false) }
  }

  async function nativeShare() {
    try {
      let file = null
      if (format === 'image') file = await buildAnnouncementImage(notice, affectedHomes)
      if (format === 'pdf') file = await buildAnnouncementPdf(notice, affectedHomes)
      if (file) {
        const sharedFile = await shareAnnouncementFile({ title, text, file, url: notice.shareUrl })
        if (!sharedFile) {
          await downloadFile(file)
          showToast({ message: `This browser cannot attach ${format.toUpperCase()} files to its share sheet. The file was saved instead.`, type: 'warning' })
        }
        return
      }
      const shared = await shareNative({ title, text, url: notice.shareUrl })
      if (!shared) showToast({ message: 'Native sharing is not available on this device.', type: 'warning' })
    } catch (e) {
      if (e?.name !== 'AbortError') showToast({ message: e.message || 'Could not share', type: 'error' })
    }
  }

  async function downloadFile(file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function downloadFormat() {
    const file = format === 'image' ? await buildAnnouncementImage(notice, affectedHomes) : await buildAnnouncementPdf(notice, affectedHomes)
    await downloadFile(file)
  }

  return <div className="fixed inset-0 z-[80] bg-black/50 p-3 sm:p-6 grid place-items-center" role="dialog" aria-modal="true" aria-labelledby="share-announcement-title">
    <div className="w-full max-w-xl max-h-[92vh] overflow-auto bg-paper-raised rounded-2xl shadow-2xl border border-brass/20 p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="share-announcement-title" className="font-semibold text-ink">Share announcement</h2><p className="text-xs text-ink-soft mt-1">English + Tamil are included. Edit Tamil before posting; image/PDF sharing uses the actual file when your device supports file sharing.</p></div>
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center hover:bg-paper" aria-label="Close"><X size={18}/></button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[['text','Text'],['image','Image'],['pdf','PDF']].map(([id,label]) => <button key={id} type="button" onClick={() => setFormat(id)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${format === id ? 'border-brand bg-brand/10 text-brand' : 'border-brass/20 text-ink-soft'}`}>{label}</button>)}
      </div>

      <div className="mt-4 rounded-xl border border-brass/20 bg-paper p-4 whitespace-pre-wrap text-sm text-ink max-h-64 overflow-auto">{text}</div>

      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        {format === 'text' ? <>
          <button type="button" onClick={() => shareViaWhatsApp(text)} className="rounded-xl bg-[#25D366] text-white py-3 text-sm font-bold flex items-center justify-center gap-2"><MessageCircle size={17}/> WhatsApp text</button>
          <button type="button" onClick={() => shareViaEmail(title, text)} className="rounded-xl bg-brand text-white py-3 text-sm font-bold flex items-center justify-center gap-2"><Mail size={17}/> Email text</button>
        </> : <button type="button" onClick={nativeShare} className="sm:col-span-2 rm-secondary-button py-3 flex items-center justify-center gap-2"><Share2 size={17}/> Share actual {format.toUpperCase()} file</button>}
        {format === 'text' ? <button type="button" onClick={copyText} className="rm-secondary-button py-3 flex items-center justify-center gap-2"><Copy size={17}/> Copy text</button> : <button type="button" onClick={downloadFormat} className="rm-secondary-button py-3 flex items-center justify-center gap-2"><Download size={17}/> Save {format.toUpperCase()}</button>}{user?.role === 'owner' || user?.role === 'admin' ? <button type="button" disabled={postingToCommunity} onClick={postToCommunity} className="rm-secondary-button py-3 flex items-center justify-center gap-2 disabled:opacity-50"><MessageCircle size={17}/> {postingToCommunity ? 'Posting…' : 'Post to Community'}</button> : null}
      </div>

      {notice.shareUrl && <div className="mt-4 rounded-xl bg-brand/5 border border-brand/15 p-3 text-xs text-ink-soft break-all"><span className="font-semibold text-ink">Detailed link:</span> {notice.shareUrl}</div>}
    </div>
  </div>
}
