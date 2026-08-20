import { useEffect, useRef, useState } from 'react'
import { postMessage, listRecentMessages, deleteMessage } from '../../services/communityService'

export default function CommunityBoard({ user, canModerate = false }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const msgs = await listRecentMessages()
    setMessages(msgs)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      await postMessage({
        authorId: user.uid,
        authorName: user.name,
        authorRole: user.role,
        houseId: user.houseId || null,
        text: text.trim(),
      })
      setText('')
      refresh()
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id) {
    await deleteMessage(id)
    refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-[420px]">
      <h3 className="font-semibold text-slate-800 mb-3">Community Board</h3>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.map((m) => {
          const isMe = m.authorId === user.uid
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                isMe ? 'bg-brand text-white' : m.authorRole === 'owner' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
              }`}>
                {!isMe && (
                  <p className="text-[11px] font-semibold opacity-70 mb-0.5">
                    {m.authorName}{m.authorRole === 'owner' ? ' (Owner)' : ''}
                  </p>
                )}
                <p>{m.text}</p>
                {canModerate && (
                  <button onClick={() => handleDelete(m.id)} className="text-[10px] opacity-60 hover:opacity-100 mt-1 block">
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {messages.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the community…"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <button disabled={sending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
          Send
        </button>
      </form>
    </div>
  )
}
