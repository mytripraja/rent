import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CloudSun, MapPin, Plus, Search, Trash2, Sunrise, Sunset, Clock3 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { createCalendarNote, deleteCalendarNote, getWeather, INDIA_FESTIVALS, listCalendarNotes, panchangTimes, searchPlace, tamilDateFor } from '../../services/indiaCalendarService'
import { listUpcomingEvents } from '../../services/eventService'

const WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const WEATHER_TEXT = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail' }

function isoMonth(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
function isoDay(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function monthLabel(date) { return date.toLocaleDateString('en-IN',{month:'long',year:'numeric'}) }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth()+1, 0).getDate() }
function firstDay(date) { return new Date(date.getFullYear(), date.getMonth(), 1).getDay() }

export default function IndiaCalendar({ compact=false }) {
  const { user } = useAuth()
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => isoDay(new Date()))
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [note, setNote] = useState({ title:'', time:'', notes:'', category:'personal' })
  const [weatherPlace, setWeatherPlace] = useState({ name:'Coimbatore, Tamil Nadu', latitude:11.0168, longitude:76.9558 })
  const [weather, setWeather] = useState(null)
  const [placeQuery, setPlaceQuery] = useState('')
  const [places, setPlaces] = useState([])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [error, setError] = useState('')

  const month = isoMonth(cursor)
  const monthDays = useMemo(() => Array.from({length: daysInMonth(cursor)}, (_,i) => new Date(cursor.getFullYear(),cursor.getMonth(),i+1)), [cursor])
  const festivals = useMemo(() => INDIA_FESTIVALS.filter(f => f.date.startsWith(month)), [month])
  const selectedFestivals = festivals.filter(f => f.date === selected)
  const selectedNotes = notes.filter(n => n.date === selected)
  const selectedEvents = events.filter(e => e.date === selected)
  const tamil = tamilDateFor(selected)
  const panchang = panchangTimes(selected)

  useEffect(() => { listCalendarNotes(user?.uid, month).then(setNotes).catch(() => setNotes([])); listUpcomingEvents().then(setEvents).catch(() => setEvents([])) }, [user?.uid, month])
  useEffect(() => { loadWeather(weatherPlace) }, [weatherPlace])
  async function loadWeather(place) { setWeatherLoading(true); try { setWeather(await getWeather(place)) } catch(e) { setError(e.message) } finally { setWeatherLoading(false) } }
  async function findPlaces() { if (!placeQuery.trim()) return; try { setPlaces(await searchPlace(placeQuery.trim())) } catch(e) { setError(e.message) } }
  async function saveNote(e) { e.preventDefault(); if (!note.title.trim() || !user?.uid) return; try { await createCalendarNote({ userId:user.uid, title:note.title.trim(), date:selected, time:note.time, notes:note.notes, category:note.category }); setNotes(await listCalendarNotes(user.uid, month)); setNote({title:'',time:'',notes:'',category:'personal'}); setShowAdd(false) } catch(e) { setError(e.message) } }
  async function removeNote(id) { try { await deleteCalendarNote(id); setNotes(await listCalendarNotes(user.uid, month)) } catch(e) { setError(e.message) } }

  return <div className={`space-y-5 ${compact ? '' : 'rm-card p-4 sm:p-6'}`}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><div className="rm-kicker">India calendar</div><h2 className="font-display text-2xl font-extrabold mt-1">Calendar & Panchang</h2><p className="text-sm text-ink-soft mt-1">English date, Tamil date, festivals, family notes and daily timings.</p></div>
      <button onClick={() => setShowAdd(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/> Add my event</button>
    </div>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">{error}</div>}

    <section className="rounded-2xl border border-[var(--rm-border)] bg-paper p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3"><button onClick={() => setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))} className="p-2 rounded-xl border border-[var(--rm-border)]"><ChevronLeft size={18}/></button><div className="text-center"><p className="font-bold text-ink">{monthLabel(cursor)}</p><p className="text-xs text-ink-soft">{monthDays.length} days · Tamil month shown on each day</p></div><button onClick={() => setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))} className="p-2 rounded-xl border border-[var(--rm-border)]"><ChevronRight size={18}/></button></div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs font-bold text-ink-soft">{WEEK.map(d=><div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({length:firstDay(cursor)}).map((_,i)=><div key={`blank-${i}`} />)}
        {monthDays.map(day => { const d=isoDay(day), tf=tamilDateFor(d), fest=festivals.filter(f=>f.date===d), mine=notes.some(n=>n.date===d), event=events.some(e=>e.date===d); const active=d===selected; return <button key={d} onClick={()=>setSelected(d)} className={`min-h-[68px] sm:min-h-[82px] rounded-xl border p-1.5 text-left transition ${active?'border-brand bg-brand/10 shadow-sm':'border-[var(--rm-border)] bg-paper-raised hover:border-brand/30'}`}><div className="flex items-center justify-between"><span className={`text-sm font-bold ${active?'text-brand':'text-ink'}`}>{day.getDate()}</span>{d===isoDay(new Date())&&<span className="w-1.5 h-1.5 rounded-full bg-brand"/>}</div><p className="text-[9px] text-ink-soft mt-1 truncate">{tf.month} {tf.day}</p>{fest.slice(0,2).map(f=><p key={f.title} className="text-[9px] font-semibold text-amber-700 truncate">• {f.title}</p>)}{(fest.length>2)&&<p className="text-[9px] text-ink-soft">+{fest.length-2} more</p>}{mine&&<span className="inline-block mt-1 w-1.5 h-1.5 rounded-full bg-brand"/>}{event&&<span className="inline-block ml-1 mt-1 w-1.5 h-1.5 rounded-full bg-ink-soft"/>}</button> })}
      </div>
    </section>

    <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-4">
      <section className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
        <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.14em] font-bold text-ink-soft">Selected day</p><h3 className="font-display text-xl font-bold text-ink mt-1">{new Date(`${selected}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h3><p className="text-sm text-brand font-semibold mt-1">தமிழ்: {tamil.label}</p></div><CalendarDays className="text-brand"/></div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-brand/5 border border-brand/10 p-3"><p className="text-xs font-bold text-ink-soft">நல்ல நேரம் · Nalla Neram</p>{panchang.nallaNeram.map(x=><p key={x[0]} className="text-sm font-semibold text-ink mt-1">{x[0]} – {x[1]}</p>)}</div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3"><p className="text-xs font-bold text-amber-800">Rahu Kalam</p><p className="text-sm font-semibold text-amber-900 mt-1">{panchang.rahu}</p><p className="text-xs font-bold text-amber-800 mt-3">Yamagandam · எமகண்டம்</p><p className="text-sm font-semibold text-amber-900 mt-1">{panchang.yamagandam}</p></div>
        </div>
        <p className="text-[11px] text-ink-soft mt-3">Panchang timings are a traditional reference and use a 06:00–18:00 daylight model in this app; exact local almanac timings can vary by place and sunrise.</p>
        <div className="mt-4 space-y-2"><h4 className="text-sm font-bold text-ink">Festivals & functions</h4>{[...selectedFestivals.map(f=>({id:`f-${f.title}`,title:f.title,sub:f.tradition})),...selectedEvents.map(e=>({id:e.id,title:e.title,sub:`${e.time||'All day'} · ${e.type||'Event'}` }))].map(x=><div key={x.id} className="rounded-xl border border-[var(--rm-border)] bg-paper-raised p-3"><p className="font-semibold text-ink">{x.title}</p><p className="text-xs text-ink-soft mt-1">{x.sub}</p></div>)}{selectedFestivals.length===0&&selectedEvents.length===0&&<p className="text-sm text-ink-soft">No festival or shared function recorded for this day.</p>}</div>
        <div className="mt-4 space-y-2"><div className="flex items-center justify-between"><h4 className="text-sm font-bold text-ink">My events</h4><button onClick={()=>setShowAdd(true)} className="text-xs font-bold text-brand">Add</button></div>{selectedNotes.map(n=><div key={n.id} className="flex items-start gap-3 rounded-xl border border-[var(--rm-border)] bg-paper-raised p-3"><div className="flex-1"><p className="font-semibold text-ink">{n.title}</p><p className="text-xs text-ink-soft">{n.time||'All day'}{n.notes?` · ${n.notes}`:''}</p></div><button onClick={()=>removeNote(n.id)} className="p-1.5 text-ink-soft hover:text-red-600" aria-label="Delete event"><Trash2 size={15}/></button></div>)}{selectedNotes.length===0&&<p className="text-sm text-ink-soft">No personal events on this date.</p>}</div>
      </section>

      <section className="rounded-2xl border border-[var(--rm-border)] bg-paper p-4">
        <div className="flex items-center gap-2"><CloudSun className="text-brand"/><div><p className="text-xs uppercase tracking-[.14em] font-bold text-ink-soft">Weather</p><h3 className="font-display text-xl font-bold text-ink">{weatherPlace.name}</h3></div></div>
        <div className="flex gap-2 mt-3"><input value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&findPlaces()} placeholder="Search city or place" className="min-w-0 flex-1"/><button onClick={findPlaces} className="p-3 rounded-xl bg-brand text-white"><Search size={17}/></button></div>
        {places.length>0&&<div className="mt-2 rounded-xl border border-[var(--rm-border)] bg-paper-raised overflow-hidden">{places.map(p=><button key={p.id} onClick={()=>{setWeatherPlace(p);setPlaces([]);setPlaceQuery('')}} className="w-full text-left px-3 py-2.5 hover:bg-brand/5 text-sm"><MapPin size={14} className="inline mr-2 text-brand"/>{p.name}{p.admin1?`, ${p.admin1}`:''} · {p.country}</button>)}</div>}
        {weatherLoading ? <div className="py-10 text-center text-sm text-ink-soft">Loading weather…</div> : weather ? <><div className="rounded-2xl bg-brand/5 border border-brand/10 p-4 mt-3"><p className="text-3xl font-bold text-ink">{Math.round(weather.current.temperature_2m)}°C</p><p className="text-sm text-ink-soft mt-1">{WEATHER_TEXT[weather.current.weather_code]||'Current conditions'} · feels {Math.round(weather.current.apparent_temperature)}°C</p><div className="flex gap-4 mt-3 text-xs text-ink-soft"><span>Humidity {weather.current.relative_humidity_2m}%</span><span>Wind {Math.round(weather.current.wind_speed_10m)} km/h</span></div></div><div className="mt-4 space-y-2">{weather.daily.time.map((date,i)=><div key={date} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 rounded-xl border border-[var(--rm-border)] p-2.5"><p className="text-xs font-semibold text-ink">{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN',{weekday:'short',day:'numeric'})}</p><p className="text-xs text-ink-soft">{WEATHER_TEXT[weather.daily.weather_code[i]]||'Conditions'} · rain {weather.daily.precipitation_probability_max[i]||0}%</p><p className="text-xs font-bold text-ink">{Math.round(weather.daily.temperature_2m_min[i])}° / {Math.round(weather.daily.temperature_2m_max[i])}°</p></div>)}</div></> : <p className="py-8 text-center text-sm text-ink-soft">Weather unavailable.</p>}
      </section>
    </div>

    {showAdd&&<div className="fixed inset-0 z-[90] bg-black/45 p-4 grid place-items-center" onMouseDown={e=>e.currentTarget===e.target&&setShowAdd(false)}><form onSubmit={saveNote} className="w-full max-w-md rm-card p-5"><div className="flex items-center justify-between"><h3 className="font-display text-xl font-bold text-ink">Add to my calendar</h3><button type="button" onClick={()=>setShowAdd(false)} className="text-ink-soft">×</button></div><p className="text-xs text-ink-soft mt-1">{new Date(`${selected}T12:00:00`).toLocaleDateString('en-IN',{dateStyle:'full'})}</p><input required value={note.title} onChange={e=>setNote(v=>({...v,title:e.target.value}))} placeholder="Event or reminder" className="w-full mt-4"/><div className="grid grid-cols-2 gap-3 mt-3"><input type="time" value={note.time} onChange={e=>setNote(v=>({...v,time:e.target.value}))}/><select value={note.category} onChange={e=>setNote(v=>({...v,category:e.target.value}))}><option value="personal">Personal</option><option value="family">Family</option><option value="maintenance">Maintenance</option><option value="payment">Payment</option><option value="function">Function</option></select></div><textarea value={note.notes} onChange={e=>setNote(v=>({...v,notes:e.target.value}))} placeholder="Notes" className="w-full mt-3 min-h-24"/><button className="w-full mt-4 rounded-xl bg-brand text-white font-bold py-3">Save event</button></form></div>}
  </div>
}
