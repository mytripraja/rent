import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { listHouses } from './houseService'

export async function getAnalyticsData() {
  const houses = await listHouses()
  
  // Very simple mocked data for the dashboard for MVP
  // In a real app, this would query rent history, expenses, complaints over time
  
  const occupied = houses.filter(h => h.status === 'occupied').length
  const total = houses.length
  
  // Occupancy history (mocked past 12 months)
  const occupancyHistory = Array.from({length: 12}).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      rate: total > 0 ? Math.round(((occupied - Math.floor(Math.random() * 2)) / total) * 100) : 0
    }
  })

  // Revenue forecast
  const currentExpected = houses.filter(h => h.status === 'occupied').reduce((sum, h) => sum + (Number(h.rentAmount) || 0), 0)
  const projected = currentExpected * 3 // next 3 months

  // Tenant reliability scores
  const tenantScores = houses.filter(h => h.status === 'occupied').map(h => ({
    houseId: h.id,
    doorNumber: h.internalDoorNumber,
    name: h.tenantName,
    score: Math.floor(Math.random() * 40) + 60 // 60-100 random score
  }))

  // Delay pattern
  const delayPatterns = houses.filter(h => h.status === 'occupied').map(h => ({
    houseId: h.id,
    doorNumber: h.internalDoorNumber,
    avgDays: Math.floor(Math.random() * 10), // 0-10 days
    consecutiveOnTime: Math.floor(Math.random() * 6)
  }))
  
  return {
    occupancyHistory,
    currentExpected,
    projected,
    tenantScores,
    delayPatterns
  }
}
