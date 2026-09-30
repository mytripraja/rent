import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Search, Send, Users, X } from 'lucide-react'
import { postMessage, subscribeToMessages, deleteMessage } from '../../services/communityService'
import { canPerformAction } from '../../utils/rateLimit'
import { useToast } from './ui/Toast'

const MAX_MESSAGE_LENGTH = 500

function renderMessageText(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, index) => /^https?:\/\//i.test(part)
    ? <a key={index} href={part} target="_blank" rel="noreferrer" className="underline font-semibold break-all">{part}</a>
    : <span key={index}>{part}</span>)
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - Number(value || 0)) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function CommunityBoard({ user, canModerate = false }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const { showToast } = useToast()

  useEffect(() => {
    const unsub = subscribeToMessages((msgs) => setMessages(msgs))
    return () => unsub()
  }, [])

  const visibleMessages = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return messages.filter(m => {
      if (filter === 'mine' && m.authorId !== user.uid) return false
      if (pinnedOnly && !m.pinned) return false
      if (!needle) return true
      return `${m.text || ''} ${m.authorName || ''}`.toLowerCase().includes(needle)
    })
  }, [messages, search, filter, pinnedOnly, user.uid])

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    if (value.length > MAX_MESSAGE_LENGTH) return showToast({ message: `Keep the message under ${MAX_MESSAGE_LENGTH} characters.`, type: 'warning' })
    if (!canPerformAction('community_post', 3000)) {
      showToast({ message: 'Please wait before posting again.', type: 'warning' })
      return
    }
    setSending(true)
    try {
      await postMessage({
        authorId: user.uid,
        authorName: user.name,
        authorRole: user.role,
        houseId: user.houseId || null,
        text: value,
      })
      setText('')
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    } catch (err) {
      showToast({ message: err.message || 'Could not post message.', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    try { await deleteMessage(id) } catch (err) { showToast({ message: err.message || 'Could not delete message.', type: 'error' }) }
  }

  return (
    <section className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm overflow-hidden flex flex-col min-h-[460px] h-[min(70vh,620px)]">
      <header className="p-4 sm:p-5 border-b border-[var(--rm-border)] bg-paper-raised/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0"><MessageCircle size={19}/></span>
            <div className="min-w-0"><h3 className="font-semibold text-ink">Community</h3><p className="text-xs text-ink-soft flex items-center gap-1.5 mt-0.5"><Users size={12}/> {messages.length} recent messages · residents & management</p></div>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
          <label className="relative min-w-0"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search community…" className="w-full border border-brass/25 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-brand/20"/></label>
          <div className="flex rounded-xl border border-brass/20 p-1 bg-paper"><button type="button" onClick={()=>{setFilter('all');setPinnedOnly(false)}} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter==='all'?'bg-brand text-white':'text-ink-soft'}`}>All</button><button type="button" onClick={()=>{setFilter('mine');setPinnedOnly(false)}} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter==='mine'?'bg-brand text-white':'text-ink-soft'}`}>Mine</button></div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {visibleMessages.map((m) => {
          const isMe = m.authorId === user.uid
          return <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm border ${isMe ? 'bg-brand text-white border-brand' : m.authorRole === 'owner' ? 'bg-amber-50 text-amber-950 border-amber-200' : 'bg-paper text-ink border-[var(--rm-border)]'}`}>
              <div className="flex items-center gap-2 mb-1">{m.pinned&&<span className="text-[9px] rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5">Pinned</span>}<span className="text-[11px] font-semibold opacity-75">{isMe ? 'You' : `${m.authorName || 'Resident'}${m.authorRole === 'owner' ? ' · Owner' : ''}`}</span><span className="text-[10px] opacity-55">{relativeTime(m.createdAt)}</span></div>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{renderMessageText(m.text)}</p>
              <div className="flex items-center justify-between gap-3 mt-1.5"><span className="text-[10px] opacity-50">{m.authorRole === 'tenant' ? 'Resident' : 'Management'}</span>{canModerate && <button type="button" onClick={() => handleDelete(m.id)} className="text-[10px] opacity-60 hover:opacity-100">Delete</button>}</div>
            </div>
          </div>
        })}
        {visibleMessages.length === 0 && <div className="h-full min-h-40 grid place-items-center text-center px-6"><div><MessageCircle className="mx-auto text-ink-soft/40" size={30}/><p className="text-sm font-semibold text-ink mt-2">{messages.length ? 'No matching messages' : 'Start the community conversation'}</p><p className="text-xs text-ink-soft mt-1">Share useful updates, questions and resident information.</p>{search && <button type="button" onClick={()=>setSearch('')} className="text-xs text-brand font-semibold mt-2 inline-flex items-center gap-1"><X size={13}/> Clear search</button>}</div></div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="p-3 sm:p-4 border-t border-[var(--rm-border)] bg-paper-raised/95 backdrop-blur sticky bottom-0">
        <div className="flex gap-2 items-end"><textarea value={text} onChange={e=>setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit(e)}}} rows={1} placeholder="Write to the community…" className="flex-1 min-w-0 resize-none border border-brass/25 rounded-xl px-3 py-2.5 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-brand/20"/><button disabled={sending || !text.trim()} className="w-11 h-11 rounded-xl bg-brand text-white grid place-items-center disabled:opacity-40 shrink-0" aria-label="Send community message"><Send size={17}/></button></div>
        <div className="flex justify-between gap-2 mt-1.5 text-[10px] text-ink-soft"><span>Enter to send · Shift+Enter for a new line</span><span>{text.length}/{MAX_MESSAGE_LENGTH}</span></div>
      </form>
    </section>
  )
}
