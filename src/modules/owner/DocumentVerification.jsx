import { useEffect, useState } from 'react'
import { listAllDocuments, getDocumentViewUrl } from '../../services/documentService'
import { listHouses } from '../../services/houseService'

export default function DocumentVerification() {
  const [docs, setDocs] = useState([])
  const [houses, setHouses] = useState([])
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    listAllDocuments().then(setDocs)
    listHouses().then(setHouses)
  }, [])

  function houseLabel(houseId) {
    return houses.find((h) => h.id === houseId)?.internalDoorNumber || houseId
  }

  // Signed URLs are minted fresh on click rather than stored, since the whole
  // point of 'authenticated' delivery is that there's no permanent public link.
  async function handleView(d) {
    setLoadingId(d.id)
    try {
      const url = await getDocumentViewUrl(d)
      window.open(url, '_blank', 'noreferrer')
    } finally {
      setLoadingId(null)
    }
  }

  const grouped = docs.reduce((acc, d) => {
    acc[d.houseId] = acc[d.houseId] || []
    acc[d.houseId].push(d)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Document Verification</h2>
        <p className="text-sm text-slate-500">Aadhaar / ration card uploads — visible to you only.</p>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-slate-400">No documents uploaded yet.</p>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([houseId, items]) => (
          <div key={houseId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">House {houseLabel(houseId)}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleView(d)}
                  disabled={loadingId === d.id}
                  className="text-left border border-slate-100 rounded-lg overflow-hidden hover:shadow-sm p-3 disabled:opacity-60"
                >
                  <p className="font-medium text-slate-700 text-sm">
                    {d.docType === 'aadhaar' ? 'Aadhaar' : 'Ration Card'} · {d.residentName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Signed: {d.consentSignatureName} · {new Date(d.uploadedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-brand mt-1.5">
                    {loadingId === d.id ? 'Generating secure link…' : 'View document →'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
