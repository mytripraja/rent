import { useState, useEffect } from 'react'
import { listSlots, createSlot, assignSlot, releaseSlot } from '../../services/parkingService'

export default function ParkingManager() {
  const [slots, setSlots] = useState([])
  
  useEffect(() => {
    load()
  }, [])

  async function load() {
    const data = await listSlots()
    setSlots(data)
  }

  async function handleAddSlot() {
    const num = prompt('Enter slot number:')
    if (!num) return
    const type = prompt('Enter type (two_wheeler or four_wheeler):', 'two_wheeler')
    await createSlot({ slotNumber: num, type })
    load()
  }

  async function handleAssign(slotId) {
    const houseId = prompt('Enter House ID:')
    if (!houseId) return
    const tenantName = prompt('Enter Tenant Name:')
    const vehicleNumber = prompt('Enter Vehicle Number:')
    await assignSlot(slotId, { houseId, tenantName, vehicleNumber })
    load()
  }

  return (
    <div className="p-4 bg-paper min-h-screen font-sans text-ink">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display text-cover">Parking Manager</h1>
        <button onClick={handleAddSlot} className="px-4 py-2 bg-cover text-paper rounded text-sm">Add Slot</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {slots.map(slot => (
          <div key={slot.id} className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center text-center h-32 ${slot.status === 'assigned' ? 'bg-stamp-green/10 border-stamp-green text-stamp-green' : 'bg-paper-raised border-ink/20 text-ink-soft'}`}>
            <span className="font-bold text-xl">{slot.slotNumber}</span>
            <span className="text-xs uppercase mt-1">{slot.type.replace('_', ' ')}</span>
            
            {slot.status === 'assigned' ? (
              <div className="mt-2 text-xs">
                <p className="font-bold text-ink">{slot.assignedHouseId} - {slot.assignedTenantName}</p>
                <p className="font-mono">{slot.vehicleNumber}</p>
                <button onClick={() => releaseSlot(slot.id).then(load)} className="text-stamp-red mt-1 underline">Release</button>
              </div>
            ) : (
              <button onClick={() => handleAssign(slot.id)} className="mt-2 text-xs bg-cover text-paper px-3 py-1 rounded-full">Assign</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
