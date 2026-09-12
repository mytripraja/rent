import { useState, useEffect } from 'react'
import { listHouses } from '../../services/houseService'
import { Share2, Copy } from 'lucide-react'

export default function VacancyListing() {
  const [vacantHouses, setVacantHouses] = useState([])

  useEffect(() => {
    listHouses().then(houses => {
      setVacantHouses(houses.filter(h => h.status === 'vacant'))
    })
  }, [])

  const generateText = (house) => {
    return `🏠 House Available for Rent\nFloor: ${house.floor}\nDoor: ${house.id}\nRent: ₹${house.rentAmount}/month\nContact Owner`
  }

  const handleShare = async (house) => {
    const text = generateText(house)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'House for Rent', text })
      } catch (e) {
        console.error(e)
      }
    } else {
      navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-6">Vacancy Listings</h2>
      
      <div className="space-y-4">
        {vacantHouses.length === 0 && <p className="text-ink-soft">No vacant houses currently.</p>}
        {vacantHouses.map(h => (
          <div key={h.id} className="bg-paper-raised p-4 rounded-lg shadow-sm border border-ink/10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-xl">{h.id}</h3>
                <p className="text-ink-soft">{h.floor} Floor</p>
              </div>
              <span className="bg-stamp-green text-paper px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                ₹{h.rentAmount}/mo
              </span>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button 
                onClick={() => navigator.clipboard.writeText(generateText(h))}
                className="flex-1 flex items-center justify-center gap-2 border border-ink/20 py-2 rounded"
              >
                <Copy size={16} /> Copy
              </button>
              <button 
                onClick={() => handleShare(h)}
                className="flex-1 flex items-center justify-center gap-2 bg-cover text-paper py-2 rounded"
              >
                <Share2 size={16} /> Share
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
