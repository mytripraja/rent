import { useEffect, useState } from 'react'
import { getTenantHouseProfile } from '../../services/houseService'
import { useAuth } from '../../context/AuthContext'

export default function RentRevisionBanner() {
  const { user } = useAuth()
  const [house, setHouse] = useState(null)

  useEffect(() => {
    if (user?.houseId) getTenantHouseProfile().then(setHouse)
  }, [user])

  if (!house?.pendingRentAmount) return null

  return (
    <div className="rounded-xl p-4 mb-3 shadow-sm border bg-blue-50 border-blue-200 text-blue-800">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1">Rent Update</p>
      <p className="text-sm">
        From {house.pendingRentEffectiveMonth}, your rent will be ₹{house.pendingRentAmount} (currently ₹{house.rentAmount}).
      </p>
    </div>
  )
}
