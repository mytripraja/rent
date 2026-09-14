import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { listHouses } from './houseService'
import { listRentHistory } from './rentService'
import { listExpenses } from './expenseService'
import { listAllComplaints } from './complaintService'
import { listEbBillCycles, listEbPaymentsForBill } from './ebBillService'
import { listWaterBillCycles, listWaterPaymentsForBill } from './waterBillService'
import { getAppConfig } from './configService'

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number)
  const d = new Date(year, monthNumber - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  return {
    start: new Date(year, monthNumber - 1, 1).getTime(),
    end: new Date(year, monthNumber, 0, 23, 59, 59, 999).getTime(),
  }
}

function historyActiveInMonth(entry, month) {
  const { start, end } = monthRange(month)
  const movedIn = Number(entry.movedInAt || 0)
  const movedOut = entry.movedOutAt == null ? null : Number(entry.movedOutAt)
  return movedIn <= end && (movedOut == null || movedOut >= start)
}


function paymentDate(payment) {
  const value = payment.approvedAt || payment.dateSent || payment.submittedAt
  return value ? new Date(value) : null
}

function dueDateForMonth(month, dueDay) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const day = Math.min(Math.max(1, Number(dueDay) || 5), lastDay)
  return new Date(year, monthNumber - 1, day, 23, 59, 59, 999)
}

export async function getAnalyticsData() {
  const [houses, complaints, config] = await Promise.all([
    listHouses(),
    listAllComplaints(),
    getAppConfig(),
  ])

  const histories = await Promise.all(houses.map(async house => ({
    house,
    history: await getDocs(collection(db, 'houses', house.id, 'history'))
  })))

  const historyByHouse = new Map(histories.map(({ house, history }) => [
    house.id,
    history.docs.map(d => ({ id: d.id, ...d.data() }))
  ]))

  const rentHistories = await Promise.all(houses.map(async house => ({
    house,
    payments: await listRentHistory(house.id),
  })))

  const rentByHouse = new Map(rentHistories.map(({ house, payments }) => [house.id, payments]))
  const months = Array.from({ length: 12 }, (_, index) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - index))
    return monthKey(d)
  })

  const occupancyHistory = months.map(month => {
    let occupied = 0
    houses.forEach(house => {
      const history = historyByHouse.get(house.id) || []
      const active = history.some(entry => historyActiveInMonth(entry, month))
      const fallback = !history.length && house.status === 'occupied'
      if (active || fallback) occupied++
    })
    return {
      month: new Date(`${month}-01T00:00:00`).toLocaleString('en-IN', { month: 'short' }),
      rate: houses.length ? Math.round((occupied / houses.length) * 100) : 0,
      occupied,
      total: houses.length,
    }
  })

  const currentMonth = monthKey()
  const currentExpected = houses
    .filter(h => h.status === 'occupied')
    .reduce((sum, h) => sum + (Number(h.rentAmount) || 0), 0)

  const monthlyRent = months.map(month => {
    let expected = 0
    let collected = 0
    houses.forEach(house => {
      const history = historyByHouse.get(house.id) || []
      const activeEntries = history.filter(entry => historyActiveInMonth(entry, month))
      if (activeEntries.length) expected += Number(activeEntries[activeEntries.length - 1].rentAmount || house.rentAmount || 0)
      else if (!history.length && house.status === 'occupied') expected += Number(house.rentAmount || 0)
      collected += (rentByHouse.get(house.id) || [])
        .filter(p => p.month === month && p.status === 'approved')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    })
    return { month, expected, collected, pending: Math.max(0, expected - collected) }
  })

  const tenantScores = []
  const delayPatterns = []
  const dueDay = config.dueDate || 5

  houses.forEach(house => {
    const payments = (rentByHouse.get(house.id) || []).filter(p => p.status === 'approved')
    const history = historyByHouse.get(house.id) || []
    const activeMonths = months.filter(month => {
      if (history.length) return history.some(entry => historyActiveInMonth(entry, month))
      return house.status === 'occupied'
    })
    if (!activeMonths.length) return

    const paidMonths = activeMonths.filter(month => payments.some(p => p.month === month))
    const score = Math.round((paidMonths.length / activeMonths.length) * 100)
    const lateDays = payments
      .filter(p => activeMonths.includes(p.month))
      .map(p => {
        const paid = paymentDate(p)
        if (!paid) return 0
        return Math.max(0, Math.ceil((paid.getTime() - dueDateForMonth(p.month, dueDay).getTime()) / 86400000))
      })
    const avgDays = lateDays.length ? Math.round((lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10) / 10 : 0

    let consecutiveOnTime = 0
    for (let i = activeMonths.length - 1; i >= 0; i--) {
      const month = activeMonths[i]
      const payment = payments.find(p => p.month === month)
      if (!payment) break
      const paid = paymentDate(payment)
      if (!paid || paid.getTime() > dueDateForMonth(month, dueDay).getTime()) break
      consecutiveOnTime++
    }

    tenantScores.push({
      houseId: house.id,
      doorNumber: house.internalDoorNumber || house.govtDoorNumber || house.id,
      name: house.tenantName || history[history.length - 1]?.name || 'Resident',
      score,
      paidMonths: paidMonths.length,
      expectedMonths: activeMonths.length,
    })
    delayPatterns.push({
      houseId: house.id,
      doorNumber: house.internalDoorNumber || house.govtDoorNumber || house.id,
      avgDays,
      consecutiveOnTime,
    })
  })

  const [expenses, ebCycles, waterCycles] = await Promise.all([
    Promise.all(months.map(month => listExpenses(month))),
    listEbBillCycles(),
    listWaterBillCycles(),
  ])

  const expenseByMonth = new Map(months.map((month, index) => [
    month,
    expenses[index].reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  ]))

  const approvedPaymentsTotal = async (cycles, listPayments) => {
    const rows = await Promise.all(cycles.map(async cycle => {
      const payments = await listPayments(cycle.id)
      return payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    }))
    return rows.reduce((sum, value) => sum + value, 0)
  }

  const projected = currentExpected * 3
  const openComplaints = complaints.filter(c => c.status === 'open').length
  const firstMonth = shiftMonth(currentMonth, -11)
  const recentEbCycles = ebCycles.filter(c => c.createdAt && monthKey(new Date(c.createdAt)) >= firstMonth)
  const recentWaterCycles = waterCycles.filter(c => c.createdAt && monthKey(new Date(c.createdAt)) >= firstMonth)

  return {
    occupancyHistory,
    currentExpected,
    projected,
    monthlyRent,
    tenantScores,
    delayPatterns,
    expenseByMonth: Object.fromEntries(expenseByMonth),
    openComplaints,
    ebCycleCount: recentEbCycles.length,
    waterCycleCount: recentWaterCycles.length,
    ebCollectedLast12: await approvedPaymentsTotal(recentEbCycles, listEbPaymentsForBill),
    waterCollectedLast12: await approvedPaymentsTotal(recentWaterCycles, listWaterPaymentsForBill),
  }
}

export async function getYearSummary(year) {
  const currentMonth = monthKey()
  const [houses, complaints, config, ebCycles, waterCycles] = await Promise.all([
    listHouses(),
    listAllComplaints(),
    getAppConfig(),
    listEbBillCycles(),
    listWaterBillCycles(),
  ])

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const rentRows = await Promise.all(houses.map(async house => ({
    house,
    history: (await getDocs(collection(db, 'houses', house.id, 'history'))).docs.map(d => d.data()),
    payments: await listRentHistory(house.id),
  })))

  const expenses = await Promise.all(months.map(month => listExpenses(month)))
  const annualExpenses = expenses.flat().reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const perHouse = rentRows.map(({ house, history, payments }) => {
    let expected = 0
    let collected = 0
    let occupiedMonths = 0
    let unpaidMonths = 0
    months.forEach(month => {
      const active = history.length ? history.filter(entry => historyActiveInMonth(entry, month)) : []
      const isOccupied = active.length > 0 || (!history.length && house.status === 'occupied' && month === currentMonth)
      if (isOccupied) {
        occupiedMonths++
        expected += Number(active[active.length - 1]?.rentAmount || house.rentAmount || 0)
        const paid = payments.some(p => p.month === month && p.status === 'approved')
        if (!paid) unpaidMonths++
      }
      collected += payments.filter(p => p.month === month && p.status === 'approved')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    })
    return {
      houseId: house.id,
      doorNumber: house.internalDoorNumber || house.govtDoorNumber || house.id,
      name: house.tenantName || history[history.length - 1]?.name || '—',
      expected,
      collected,
      occupiedMonths,
      unpaidMonths,
    }
  })

  const annualRentExpected = perHouse.reduce((sum, row) => sum + row.expected, 0)
  const annualRentCollected = perHouse.reduce((sum, row) => sum + row.collected, 0)
  const occupiedHouseMonths = perHouse.reduce((sum, row) => sum + row.occupiedMonths, 0)
  const possibleHouseMonths = houses.length * 12
  const yearEbCycles = ebCycles.filter(c => c.createdAt && new Date(c.createdAt).getFullYear() === year)
  const yearWaterCycles = waterCycles.filter(c => c.createdAt && new Date(c.createdAt).getFullYear() === year)

  const approvedCycleTotal = async (cycles, listPayments) => {
    const totals = await Promise.all(cycles.map(async cycle => {
      const payments = await listPayments(cycle.id)
      return payments.filter(p => p.status === 'approved').reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    }))
    return totals.reduce((sum, n) => sum + n, 0)
  }

  const [ebCollected, waterCollected] = await Promise.all([
    approvedCycleTotal(yearEbCycles, listEbPaymentsForBill),
    approvedCycleTotal(yearWaterCycles, listWaterPaymentsForBill),
  ])

  const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.resolvedAt && new Date(c.resolvedAt).getFullYear() === year).length

  return {
    year,
    annualRentExpected,
    annualRentCollected,
    annualExpenses,
    netOperatingResult: annualRentCollected - annualExpenses,
    occupancyRate: possibleHouseMonths ? Math.round((occupiedHouseMonths / possibleHouseMonths) * 100) : 0,
    perHouse,
    ebCycleCount: yearEbCycles.length,
    ebCollected,
    waterCycleCount: yearWaterCycles.length,
    waterCollected,
    resolvedComplaints,
    totalComplaints: complaints.filter(c => c.createdAt && new Date(c.createdAt).getFullYear() === year).length,
    dueDay: config.dueDate || 5,
  }
}
