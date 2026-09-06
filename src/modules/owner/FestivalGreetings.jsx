import { useState } from 'react'

export default function FestivalGreetings() {
  const [selected, setSelected] = useState('')
  const festivals = [
    { id: 'pongal', name: 'Pongal', eng: 'Wishing you and your family a very Happy Pongal!', tam: 'இனிய பொங்கல் நல்வாழ்த்துக்கள்!' },
    { id: 'diwali', name: 'Diwali', eng: 'May the festival of lights bring joy to your home. Happy Diwali!', tam: 'இனிய தீபாவளி நல்வாழ்த்துக்கள்!' },
    { id: 'newyear', name: 'New Year', eng: 'Wishing you a prosperous New Year!', tam: 'இனிய புத்தாண்டு நல்வாழ்த்துக்கள்!' }
  ]

  const activeFest = festivals.find(f => f.id === selected)

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <h1 className="text-2xl font-display text-cover mb-6">Send Festival Greetings</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        {festivals.map(f => (
          <button 
            key={f.id}
            onClick={() => setSelected(f.id)}
            className={`p-3 rounded-lg border text-center ${selected === f.id ? 'bg-cover text-paper border-cover' : 'bg-paper-raised border-ink/20'}`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {activeFest && (
        <div className="bg-paper-raised p-6 rounded-lg border-2 border-brass text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-cover"></div>
          <h2 className="text-xl font-display text-cover mb-4">{activeFest.name} Greetings</h2>
          <p className="text-lg italic mb-2">"{activeFest.eng}"</p>
          <p className="text-lg font-bold">"{activeFest.tam}"</p>
          
          <button className="mt-6 bg-cover text-paper px-6 py-2 rounded-full w-full font-bold shadow-md">
            Send to All Tenants
          </button>
        </div>
      )}
    </div>
  )
}
