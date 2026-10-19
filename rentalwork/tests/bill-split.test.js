import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateEbSplit, calculateWaterSplit } from '../src/utils/billSplit.js'

const houses = [
  { id: 'h1', internalDoorNumber: 'F1', status: 'occupied', hasOwnEbMeter: false },
  { id: 'h2', internalDoorNumber: 'F2', status: 'occupied', hasOwnEbMeter: false, ebShareOverrideMonths: 1, waterShareOverrideMonths: 1 },
  { id: 'h3', internalDoorNumber: 'F3', status: 'vacant', hasOwnEbMeter: false },
]
test('EB split excludes own-meter and vacant houses and returns finite shares', () => {
  const rows = calculateEbSplit(1200, 2, houses)
  assert.deepEqual(rows.map(x => x.houseId).sort(), ['h1', 'h2'])
  assert.ok(rows.every(x => Number.isFinite(x.shareAmount) && x.shareAmount >= 0))
})
test('water split returns shares only for occupied houses', () => {
  const rows = calculateWaterSplit(600, 2, houses)
  assert.deepEqual(rows.map(x => x.houseId).sort(), ['h1', 'h2'])
  assert.ok(rows.every(x => Number.isFinite(x.shareAmount) && x.shareAmount >= 0))
})
