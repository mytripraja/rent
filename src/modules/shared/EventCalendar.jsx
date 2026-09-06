import { useState, useEffect } from 'react'
import { listEventsForMonth, createEvent } from '../../services/eventService'
import { useAuth } from '../../context/AuthContext'
import { Calendar, Plus, CalendarPlus } from 'lucide-react'
import { createGoogleCalendarLink } from '../../utils/calendarLinks'

export default function EventCalendar() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const [events, setEvents] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    load()
  }, [month])

  async function load() {
    const data = await listEventsForMonth(month)
    setEvents(data)
  }

  async function handleAdd(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    await createEvent({
      title: fd.get('title'),
      description: fd.get('description'),
      date: fd.get('date'),
      time: fd.get('time'),
      type: fd.get('type')
    })
    setShowForm(false)
    load()
  }

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display text-cover">Community Events</h1>
        {isOwner && (
          <button onClick={() => setShowForm(!showForm)} className="p-2 bg-cover text-paper rounded-full">
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center gap-4">
        <Calendar size={24} className="text-ink-soft" />
        <input 
          type="month" 
          value={month} 
          onChange={e => setMonth(e.target.value)}
          className="bg-paper-raised border border-ink/20 p-2 rounded"
        />
      </div>

      {showForm && isOwner && (
        <form onSubmit={handleAdd} className="bg-paper-raised p-4 rounded border border-ink/10 mb-6 space-y-3">
          <input name="title" placeholder="Event Title" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
          <div className="flex gap-2">
            <input name="date" type="date" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
            <input name="time" type="time" required className="w-full p-2 border border-ink/20 rounded bg-paper" />
          </div>
          <select name="type" required className="w-full p-2 border border-ink/20 rounded bg-paper">
            <option value="festival">Festival</option>
            <option value="meeting">Meeting</option>
            <option value="maintenance">Maintenance</option>
            <option value="other">Other</option>
          </select>
          <textarea name="description" placeholder="Description" className="w-full p-2 border border-ink/20 rounded bg-paper"></textarea>
          <button type="submit" className="w-full py-2 bg-cover text-paper rounded">Add Event</button>
        </form>
      )}

      <div className="space-y-4">
        {events.map(ev => (
          <div key={ev.id} className="bg-paper-raised p-4 rounded-lg shadow-sm border-l-4 border-cover relative">
            <h3 className="font-medium text-lg pr-10">{ev.title}</h3>
            <p className="text-sm text-ink-soft mb-2">{ev.date} at {ev.time} • {ev.type}</p>
            {ev.description && <p className="text-sm mb-3">{ev.description}</p>}
            <a 
              href={createGoogleCalendarLink({ title: ev.title, description: ev.description, date: ev.date, time: ev.time, allDay: false })}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand hover:underline flex items-center gap-1 w-max"
            >
              <CalendarPlus size={14} /> Add to Google Calendar
            </a>
          </div>
        ))}
        {events.length === 0 && <p className="text-ink-soft text-center py-8">No events this month.</p>}
      </div>
    </div>
  )
}
