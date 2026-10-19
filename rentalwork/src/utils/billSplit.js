function round2(value) { return Math.round(value * 100) / 100 }

export function calculateEbSplit(totalAmount, cycleMonths, houses = []) {
  const eligible = houses.filter(h => h.status === 'occupied' && !h.hasOwnEbMeter)
  if (!eligible.length || !(Number(cycleMonths) > 0) || !(Number(totalAmount) >= 0)) return []
  const baseShare = Number(totalAmount) / eligible.length
  let shortfall = 0
  const partial = []
  const full = []
  eligible.forEach(h => {
    const monthsOccupied = Math.max(0, Math.min(Number(cycleMonths), Number(h.ebShareOverrideMonths ?? cycleMonths)))
    if (monthsOccupied < cycleMonths) {
      const shareAmount = baseShare * monthsOccupied / cycleMonths
      shortfall += baseShare - shareAmount
      partial.push({ houseId: h.id, internalDoorNumber: h.internalDoorNumber, monthsOccupied, shareAmount: round2(shareAmount) })
    } else full.push(h)
  })
  const redistribution = full.length ? shortfall / full.length : 0
  return [...full.map(h => ({ houseId: h.id, internalDoorNumber: h.internalDoorNumber, monthsOccupied: Number(cycleMonths), shareAmount: round2(baseShare + redistribution) })), ...partial].sort((a,b) => String(a.internalDoorNumber).localeCompare(String(b.internalDoorNumber)))
}

export function calculateWaterSplit(totalAmount, cycleMonths, houses = []) {
  const eligible = houses.filter(h => h.status === 'occupied')
  if (!eligible.length || !(Number(cycleMonths) > 0) || !(Number(totalAmount) >= 0)) return []
  const baseShare = Number(totalAmount) / eligible.length
  let shortfall = 0
  const partial = []
  const full = []
  eligible.forEach(h => {
    const monthsOccupied = Math.max(0, Math.min(Number(cycleMonths), Number(h.waterShareOverrideMonths ?? h.ebShareOverrideMonths ?? cycleMonths)))
    if (monthsOccupied < cycleMonths) {
      const shareAmount = baseShare * monthsOccupied / cycleMonths
      shortfall += baseShare - shareAmount
      partial.push({ houseId: h.id, internalDoorNumber: h.internalDoorNumber, monthsOccupied, shareAmount: round2(shareAmount) })
    } else full.push(h)
  })
  const redistribution = full.length ? shortfall / full.length : 0
  return [...full.map(h => ({ houseId: h.id, internalDoorNumber: h.internalDoorNumber, monthsOccupied: Number(cycleMonths), shareAmount: round2(baseShare + redistribution) })), ...partial].sort((a,b) => String(a.internalDoorNumber).localeCompare(String(b.internalDoorNumber)))
}
