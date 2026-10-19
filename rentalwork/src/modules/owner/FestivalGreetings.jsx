import { useMemo, useState } from 'react'
import { PartyPopper, Search, Send, Languages } from 'lucide-react'
import { INDIA_FESTIVALS } from '../../services/indiaCalendarService'

const GREETINGS = {
  'Hindu': ['இனிய நல்வாழ்த்துக்கள்! உங்கள் குடும்பத்தில் மகிழ்ச்சியும் வளமும் நிறையட்டும்.', 'Warm wishes to you and your family. May this festival bring happiness and prosperity.'],
  'Muslim': ['இனிய திருநாள் நல்வாழ்த்துக்கள்! அமைதியும் நலமும் உங்கள் குடும்பத்தில் நிலவட்டும்.', 'Warm wishes to you and your family. May this occasion bring peace and blessings.'],
  'Christian': ['இனிய கிறிஸ்துமஸ் / பண்டிகை நல்வாழ்த்துக்கள்! உங்கள் இல்லம் அன்பும் அமைதியும் நிறைந்ததாக இருக்கட்டும்.', 'Warm wishes to you and your family. May your home be filled with peace and joy.'],
  'Sikh': ['இனிய குருபூரப் நல்வாழ்த்துக்கள்! உங்கள் குடும்பத்திற்கு நலமும் வளமும் கிடைக்கட்டும்.', 'Warm wishes to you and your family. May the occasion bring peace and prosperity.'],
  'Jain': ['அன்பும் அமைதியும் நிறைந்த நல்வாழ்த்துக்கள்!', 'Warm wishes for peace, kindness and well-being.'],
  'Buddhist': ['அமைதியும் நலமும் நிறைந்த நல்வாழ்த்துக்கள்!', 'Warm wishes for peace and well-being.'],
  'Tamil': ['இனிய தமிழ் திருநாள் நல்வாழ்த்துக்கள்!', 'Warm wishes on this Tamil festival.'],
  'National': ['நல்வாழ்த்துக்கள்! ஒற்றுமையும் வளமும் பெருகட்டும்.', 'Warm wishes. May unity and prosperity continue to grow.'],
  'General': ['இனிய நல்வாழ்த்துக்கள்!', 'Warm wishes to you and your family.'],
  'Regional': ['இனிய திருநாள் நல்வாழ்த்துக்கள்!', 'Warm wishes on this special occasion.'],
  'Zoroastrian': ['இனிய நவ்ரோஸ் நல்வாழ்த்துக்கள்!', 'Warm wishes for a happy and prosperous new year.'],
}

export default function FestivalGreetings() {
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const festivals = useMemo(() => {
    const year = new Date().getFullYear()
    return INDIA_FESTIVALS.filter(f => f.date.startsWith(String(year)) || f.date.startsWith(String(year + 1)))
      .filter(f => filter === 'All' || f.tradition === filter)
      .filter(f => `${f.title} ${f.tradition}`.toLowerCase().includes(query.toLowerCase()))
  }, [query, filter])
  const traditions = ['All', ...Array.from(new Set(INDIA_FESTIVALS.map(f => f.tradition)))]
  const greeting = selected ? (GREETINGS[selected.tradition] || GREETINGS.General) : null

  return <div className="space-y-5">
    <div><div className="rm-kicker">Community</div><h2 className="font-display text-2xl font-extrabold mt-1">Festival Greetings</h2><p className="text-sm text-ink-soft mt-1">A broader India festival list covering Hindu, Muslim, Christian, Sikh, Jain, Buddhist, Tamil, national and regional occasions.</p></div>
    <div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-3.5 text-ink-soft"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search festival" className="w-full pl-10"/></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="sm:w-48">{traditions.map(t=><option key={t}>{t}</option>)}</select></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">{festivals.map(f=><button key={`${f.date}-${f.title}`} onClick={()=>setSelected(f)} className={`rm-card rm-card-hover p-4 text-left ${selected?.title===f.title&&selected?.date===f.date?'border-brand ring-2 ring-brand/10':''}`}><div className="flex items-center justify-between gap-2"><PartyPopper size={18} className="text-brand"/><span className="text-[10px] rounded-full bg-brand/10 text-brand px-2 py-1 font-bold">{f.tradition}</span></div><p className="font-bold text-ink mt-3">{f.title}</p><p className="text-xs text-ink-soft mt-1">{new Date(`${f.date}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p></button>)}</div>
    {selected && <section className="rm-card p-5 sm:p-7 relative overflow-hidden"><div className="absolute inset-x-0 top-0 h-1 bg-brand"/><div className="flex items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-[.14em] font-bold text-ink-soft">{selected.tradition} · {selected.date}</div><h3 className="font-display text-2xl font-extrabold text-ink mt-1">{selected.title} Greetings</h3></div><Languages className="text-brand"/></div><p className="text-lg font-semibold text-ink mt-6">“{greeting[1]}”</p><p className="text-lg font-semibold text-brand mt-3">“{greeting[0]}”</p><button onClick={()=>alert(`Greeting prepared for ${selected.title}. Connect your WhatsApp/SMS provider to send it.`)} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-white px-5 py-3 font-bold"><Send size={16}/> Prepare for all tenants</button></section>}
  </div>
}
