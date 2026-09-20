import { collection, addDoc, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

// Major Indian festivals/observances. Lunar dates can vary by regional practice
// and moon sighting; keep the dataset easy to update each year.
export const INDIA_FESTIVALS = [
  ['2026-01-01','New Year','General'],['2026-01-03','Hazrat Ali Birthday','Muslim'],['2026-01-13','Lohri','Hindu'],['2026-01-14','Pongal','Hindu'],['2026-01-14','Makar Sankranti','Hindu'],['2026-01-23','Vasant Panchami','Hindu'],['2026-01-26','Republic Day','National'],
  ['2026-02-01','Guru Ravidas Jayanti','Hindu'],['2026-02-15','Maha Shivaratri','Hindu'],['2026-02-19','Shivaji Jayanti','Regional'],['2026-02-19','Ramadan begins','Muslim'],
  ['2026-03-03','Holika Dahan','Hindu'],['2026-03-04','Holi','Hindu'],['2026-03-19','Ugadi','Hindu'],['2026-03-19','Gudi Padwa','Hindu'],['2026-03-19','Cheti Chand','Hindu'],['2026-03-20','Jamat-ul-Vida','Muslim'],['2026-03-21','Eid al-Fitr / Ramzan Id','Muslim'],['2026-03-26','Rama Navami','Hindu'],['2026-03-31','Mahavir Jayanti','Jain'],
  ['2026-04-02','Maundy Thursday','Christian'],['2026-04-03','Good Friday','Christian'],['2026-04-05','Easter','Christian'],['2026-04-14','Tamil New Year / Puthandu','Tamil'],['2026-04-14','Vaisakhi','Sikh'],['2026-04-14','Vishu','Hindu'],['2026-04-14','Ambedkar Jayanti','National'],['2026-04-15','Bohag Bihu','Regional'],
  ['2026-05-01','Buddha Purnima','Buddhist'],['2026-05-28','Eid al-Adha / Bakrid','Muslim'],
  ['2026-06-26','Muharram / Ashura','Muslim'],
  ['2026-07-16','Rath Yatra','Hindu'],['2026-07-29','Guru Purnima','Hindu'],
  ['2026-08-15','Independence Day','National'],['2026-08-15','Parsi New Year','Zoroastrian'],['2026-08-26','Milad-un-Nabi','Muslim'],['2026-08-26','Onam','Hindu'],['2026-08-28','Raksha Bandhan','Hindu'],
  ['2026-09-04','Janmashtami','Hindu'],['2026-09-14','Ganesh Chaturthi','Hindu'],
  ['2026-10-02','Gandhi Jayanti','National'],['2026-10-11','Navratri begins','Hindu'],['2026-10-17','Durga Puja begins','Hindu'],['2026-10-20','Dussehra / Vijayadashami','Hindu'],['2026-10-26','Valmiki Jayanti','Hindu'],
  ['2026-11-08','Naraka Chaturdashi','Hindu'],['2026-11-08','Diwali / Deepavali','Hindu'],['2026-11-09','Govardhan Puja','Hindu'],['2026-11-11','Bhai Dooj','Hindu'],['2026-11-15','Chhath Puja','Hindu'],['2026-11-24','Guru Nanak Jayanti','Sikh'],
  ['2026-12-23','Hazrat Ali Birthday','Muslim'],['2026-12-24','Christmas Eve','Christian'],['2026-12-25','Christmas','Christian'],['2026-12-31','New Year’s Eve','General'],
  ['2027-01-01','New Year','General'],['2027-01-14','Pongal','Hindu'],['2027-01-15','Tamil Thiruvalluvar Day','Tamil'],['2027-01-16','Uzhavar Thirunal','Tamil'],['2027-01-26','Republic Day','National'],
  ['2027-02-06','Vasant Panchami','Hindu'],['2027-02-06','Ramadan begins','Muslim'],['2027-03-06','Maha Shivaratri','Hindu'],['2027-03-22','Holi','Hindu'],['2027-03-25','Ramzan Id / Eid al-Fitr','Muslim'],['2027-03-26','Good Friday','Christian'],['2027-03-28','Easter','Christian'],
  ['2027-04-14','Tamil New Year / Puthandu','Tamil'],['2027-04-15','Rama Navami','Hindu'],['2027-04-19','Mahavir Jayanti','Jain'],['2027-05-20','Bakrid / Eid al-Adha','Muslim'],['2027-06-16','Muharram / Ashura','Muslim'],['2027-07-05','Rath Yatra','Hindu'],['2027-07-18','Guru Purnima','Hindu'],['2027-08-15','Independence Day','National'],['2027-08-16','Milad-un-Nabi','Muslim'],['2027-08-17','Onam','Hindu'],['2027-08-27','Raksha Bandhan','Hindu'],['2027-08-25','Janmashtami','Hindu'],['2027-09-04','Ganesh Chaturthi','Hindu'],['2027-10-02','Gandhi Jayanti','National'],['2027-10-09','Navratri begins','Hindu'],['2027-10-18','Dussehra / Vijayadashami','Hindu'],['2027-10-29','Diwali / Deepavali','Hindu'],['2027-11-01','Govardhan Puja','Hindu'],['2027-11-02','Bhai Dooj','Hindu'],['2027-11-04','Chhath Puja','Hindu'],['2027-11-14','Guru Nanak Jayanti','Sikh'],['2027-12-25','Christmas','Christian']
].map(([date,title,tradition]) => ({ date, title, tradition }))

export const TAMIL_MONTHS = ['சித்திரை','வைகாசி','ஆனி','ஆடி','ஆவணி','புரட்டாசி','ஐப்பசி','கார்த்திகை','மார்கழி','தை','மாசி','பங்குனி']
// Tamil month boundaries for the 2026–27 cycle used by this app. The calendar
// deliberately labels this as a reference; festival observance can differ by almanac.
const TAMIL_STARTS = [
  ['2026-04-14','சித்திரை'],['2026-05-15','வைகாசி'],['2026-06-15','ஆனி'],['2026-07-17','ஆடி'],['2026-08-18','ஆவணி'],['2026-09-18','புரட்டாசி'],['2026-10-18','ஐப்பசி'],['2026-11-17','கார்த்திகை'],['2026-12-16','மார்கழி'],['2027-01-15','தை'],['2027-02-13','மாசி'],['2027-03-15','பங்குனி'],['2027-04-14','சித்திரை'],
].map(([date, month]) => ({ date, month }))

export function tamilDateFor(dateInput) {
  const date = new Date(`${dateInput}T12:00:00`)
  let current = null
  for (const item of TAMIL_STARTS) {
    if (date >= new Date(`${item.date}T00:00:00`)) current = item
    else break
  }
  if (!current) return { month: 'தமிழ்', day: '—', label: 'Tamil calendar reference unavailable' }
  const day = Math.floor((date - new Date(`${current.date}T00:00:00`)) / 86400000) + 1
  return { month: current.month, day, label: `${current.month} ${day}` }
}

const RAHU = { 0: 7, 1: 1, 2: 6, 3: 4, 4: 5, 5: 3, 6: 2 }
const YAMA = { 0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 0, 6: 6 }
export function panchangTimes(dateInput, sunrise='06:00', sunset='18:00') {
  const d = new Date(`${dateInput}T12:00:00`)
  const day = d.getDay()
  const start = 6 * 60, end = 18 * 60, segment = (end - start) / 8
  const fmt = mins => `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(Math.round(mins % 60)).padStart(2,'0')}`
  const rahuStart = start + RAHU[day] * segment
  const yamaStart = start + YAMA[day] * segment
  const good = {
    0: [['07:30','08:30'],['16:30','17:30']], 1: [['06:45','07:45'],['13:45','14:45']],
    2: [['07:45','08:45'],['14:45','15:45']], 3: [['09:30','10:30'],['16:30','17:30']],
    4: [['10:30','11:30'],['15:00','16:00']], 5: [['08:30','09:30'],['14:30','15:30']], 6: [['09:00','10:00'],['16:00','17:00']]
  }[day]
  return { sunrise, sunset, rahu: `${fmt(rahuStart)}–${fmt(rahuStart+segment)}`, yamagandam: `${fmt(yamaStart)}–${fmt(yamaStart+segment)}`, nallaNeram: good }
}

export async function listCalendarNotes(uid, month) {
  if (!uid) return []
  const snap = await getDocs(query(collection(db,'calendarNotes'), where('userId','==',uid)))
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(x => x.date?.startsWith(month)).sort((a,b) => `${a.date}${a.time||''}`.localeCompare(`${b.date}${b.time||''}`))
}
export async function createCalendarNote({ userId, title, date, time='', notes='', category='personal' }) {
  const ref = await addDoc(collection(db,'calendarNotes'), { userId, title, date, time, notes, category, createdAt: Date.now() })
  return ref.id
}
export async function deleteCalendarNote(id) { await deleteDoc(doc(db,'calendarNotes',id)) }

export async function searchPlace(place) {
  const q = encodeURIComponent(place)
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=en&format=json`)
  if (!res.ok) throw new Error('Could not search for that place.')
  const data = await res.json()
  return (data.results || []).map(x => ({ id:`${x.latitude},${x.longitude}`, name:x.name, admin1:x.admin1, country:x.country, latitude:x.latitude, longitude:x.longitude, timezone:x.timezone }))
}

export async function getWeather({ latitude, longitude }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&forecast_days=7&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather service unavailable.')
  return res.json()
}
