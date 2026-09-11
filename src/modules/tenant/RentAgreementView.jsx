import { useEffect, useState } from 'react'
import { getAgreementForHouse, getAgreementViewUrl } from '../../services/agreementService'
import Button from '../shared/ui/Button'
import { useAuth } from '../../context/AuthContext'

export default function RentAgreementView() {
  const { user } = useAuth()
  const [agreement, setAgreement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(false)
  const [viewError, setViewError] = useState('')

  useEffect(() => {
    if (user?.houseId) {
      getAgreementForHouse(user.houseId).then((a) => {
        setAgreement(a)
        setLoading(false)
      })
    }
  }, [user])

  async function handleView() {
    setViewing(true)
    setViewError('')
    try {
      const url = await getAgreementViewUrl(agreement)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setViewError(err.message || 'Could not open the agreement.')
    } finally {
      setViewing(false)
    }
  }

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5">
      <h3 className="font-semibold text-ink text-sm mb-2">Rent Agreement</h3>
      {loading && <p className="text-sm text-ink-soft" role="status">Loading…</p>}
      {!loading && !agreement && <p className="text-sm text-ink-soft">No agreement on file yet — check with the owner.</p>}
      {!loading && agreement && (
        <div className="space-y-1">
          <p className="text-sm text-ink-soft">{agreement.startDate} to {agreement.endDate} · ₹{agreement.monthlyRent}/mo</p>
          <Button size="sm" onClick={handleView} loading={viewing} loadingText="Opening…" className="mt-1">View Agreement</Button>
          {viewError && <p className="text-xs text-red-600" role="alert">{viewError}</p>}
        </div>
      )}
    </div>
  )
}
