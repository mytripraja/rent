import { useState, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

export default function PullToRefresh({ onRefresh, children }) {
  const [startY, setStartY] = useState(0)
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  
  const MAX_PULL = 100
  const THRESHOLD = 60

  const handleTouchStart = (e) => {
    if (window.scrollY <= 0) {
      setStartY(e.touches[0].clientY)
      setPulling(true)
    }
  }

  const handleTouchMove = (e) => {
    if (!pulling || refreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY
    
    if (diff > 0 && window.scrollY <= 0) {
      // Allow pulling down only if at the top
      setPullDistance(Math.min(diff * 0.4, MAX_PULL))
    }
  }

  const handleTouchEnd = async () => {
    if (!pulling) return
    
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(THRESHOLD) // hold indicator
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
    
    setPulling(false)
  }

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        style={{ 
          height: `${pullDistance}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: pulling ? 'none' : 'height 0.3s ease',
          overflow: 'hidden'
        }}
      >
        <RefreshCw 
          className={`text-brass w-6 h-6 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: pulling ? `rotate(${pullDistance * 3}deg)` : 'none' }}
        />
      </div>
      {children}
    </div>
  )
}
