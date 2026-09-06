import { useState, useEffect } from 'react'
import { getAppConfig } from '../../services/configService'

export default function WasteSchedule() {
  const [schedule, setSchedule] = useState(null)
  
  useEffect(() => {
    getAppConfig().then(config => setSchedule(config?.wasteSchedule || {}))
  }, [])

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  const getColor = (type) => {
    switch(type) {
      case 'dry': return 'bg-stamp-green/20 text-stamp-green border-stamp-green'
      case 'wet': return 'bg-brass/20 text-brass border-brass'
      case 'mixed': return 'bg-stamp-amber/20 text-stamp-amber border-stamp-amber'
      default: return 'bg-ink/5 text-ink-soft border-ink/10'
    }
  }

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <h1 className="text-2xl font-display text-cover mb-6">Waste Collection Schedule</h1>
      <div className="bg-paper-raised rounded-lg border border-ink/10 p-4">
        <div className="grid grid-cols-2 gap-4">
          {days.map(day => {
            const type = schedule?.[day.toLowerCase()] || 'none'
            return (
              <div key={day} className={`p-3 rounded border ${getColor(type)} text-center`}>
                <div className="font-bold mb-1">{day}</div>
                <div className="text-sm capitalize font-medium">{type} Waste</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
