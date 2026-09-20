import { useEffect, useState } from 'react'
import TenantsList from './TenantsList'
import TenantProfile from './TenantProfile'

export default function TenantsSection({ openHouseId, onOpenHouseHandled }) {
  const [selectedHouseId, setSelectedHouseId] = useState(null)

  useEffect(() => {
    if (openHouseId) {
      setSelectedHouseId(openHouseId)
      onOpenHouseHandled && onOpenHouseHandled()
    }
  }, [openHouseId])

  if (selectedHouseId) {
    return <TenantProfile houseId={selectedHouseId} onBack={() => setSelectedHouseId(null)} />
  }

  return <TenantsList onSelectHouse={setSelectedHouseId} />
}
