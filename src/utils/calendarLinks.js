export function createGoogleCalendarLink({ title, description, date, time, allDay = true }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description || '',
  })
  
  if (allDay) {
    const formattedDate = formatDateAllDay(date)
    // For all day events, end date should be the next day
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)
    const formattedNextDate = formatDateAllDay(nextDay.toISOString().split('T')[0])
    params.append('dates', `${formattedDate}/${formattedNextDate}`)
  } else if (date && time) {
    const startStr = `${date}T${time}`
    // Guess 1 hour duration
    const startDate = new Date(startStr)
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    params.append('dates', `${formatDateTime(startDate)}/${formatDateTime(endDate)}`)
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function formatDateAllDay(dateStr) {
  return dateStr.replace(/-/g, '')
}

function formatDateTime(dateObj) {
  return dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}
