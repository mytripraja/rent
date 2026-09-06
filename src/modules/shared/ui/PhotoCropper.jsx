import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function PhotoCropper({ file, onCrop, onCancel }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    img.onload = () => setImage(img)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!image || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, 250, 250)
    
    // Calculate aspect ratio and zoom
    const size = Math.min(image.width, image.height)
    const scale = (250 / size) * zoom
    
    const dw = image.width * scale
    const dh = image.height * scale
    const dx = (250 - dw) / 2 + offset.x
    const dy = (250 - dh) / 2 + offset.y
    
    ctx.drawImage(image, 0, 0, image.width, image.height, dx, dy, dw, dh)
  }, [image, zoom, offset])

  const handlePointerDown = (e) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }

  const handlePointerMove = (e) => {
    if (!isDragging.current) return
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    })
  }

  const handlePointerUp = () => {
    isDragging.current = false
  }

  const handleCrop = () => {
    if (!canvasRef.current) return
    canvasRef.current.toBlob((blob) => {
      onCrop(blob)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-paper-raised p-6 rounded-2xl shadow-xl w-full max-w-sm border border-brass/20 space-y-4"
      >
        <h3 className="text-lg font-semibold text-ink text-center">Crop Profile Photo</h3>
        
        <div 
          className="mx-auto w-[250px] h-[250px] bg-paper rounded-full overflow-hidden border-2 border-brass cursor-move touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <canvas ref={canvasRef} width={250} height={250} />
        </div>

        <div className="px-4">
          <label className="text-xs text-ink-soft mb-1 block">Zoom</label>
          <input 
            type="range" 
            min="1" max="3" step="0.1" 
            value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-cover"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 py-2 text-sm font-medium text-ink-soft bg-paper border border-brass/30 rounded-lg hover:bg-black/5">
            Cancel
          </button>
          <button onClick={handleCrop} className="flex-1 py-2 text-sm font-medium text-white bg-cover rounded-lg hover:bg-cover/90">
            Save Photo
          </button>
        </div>
      </motion.div>
    </div>
  )
}
