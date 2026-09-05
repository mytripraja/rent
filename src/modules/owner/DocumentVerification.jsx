import { useEffect, useState } from 'react'
import { listAllDocuments, getDocumentViewUrl, verifyDocument, requestReupload } from '../../services/documentService'
import { listHouses } from '../../services/houseService'
import { useToast } from '../shared/ui/Toast'

export default function DocumentVerification() {
  const [docs, setDocs] = useState([])
  const [houses, setHouses] = useState([])
  const [loadingId, setLoadingId] = useState(null)
  const [actingId, setActingId] = useState(null)
  const { showToast } = useToast()

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    listAllDocuments().then(setDocs).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load documents", type: "error" })
    })
    listHouses().then(setHouses).catch((err) => {
      console.error(err)
      showToast({ message: "Failed to load houses", type: "error" })
    })
  }

  function houseLabel(houseId) {
    return houses.find((h) => h.id === houseId)?.internalDoorNumber || houseId
  }

  // Signed URLs are minted fresh on click rather than stored, since the whole
  // point of 'authenticated' delivery is that there's no permanent public link.
  async function handleView(d) {
    setLoadingId(d.id)
    const win = window.open('', '_blank')
    try {
      const url = await getDocumentViewUrl(d)
      if (win) win.location.href = url
    } catch (error) {
      if (win) win.close()
      showToast({ message: 'Failed to open document', type: 'error' })
    } finally {
      setLoadingId(null)
    }
  }

  async function handleVerify(d) {
    setActingId(d.id)
    try {
      await verifyDocument(d.id)
      showToast({ message: 'Document verified successfully', type: 'success' })
      refresh()
    } catch (error) {
      showToast({ message: 'Failed to verify document', type: 'error' })
    } finally {
      setActingId(null)
    }
  }

  async function handleRequestReupload(d) {
    const reason = window.prompt('Reason for re-upload (e.g., blurry, wrong document):')
    if (!reason) return
    setActingId(d.id)
    try {
      await requestReupload(d.id, reason)
      showToast({ message: 'Re-upload requested', type: 'success' })
      refresh()
    } catch (error) {
      showToast({ message: 'Failed to request re-upload', type: 'error' })
    } finally {
      setActingId(null)
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
        <h2 className="text-lg font-semibold text-ink">Document Verification</h2>
        <p className="text-sm text-ink-soft">Aadhaar / ration card uploads — visible to you only.</p>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-ink-soft">No documents uploaded yet.</p>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([houseId, items]) => (
          <div key={houseId} className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-ink mb-3">House {houseLabel(houseId)}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((d) => (
                <div key={d.id} className="border border-brass/20 rounded-lg overflow-hidden flex flex-col hover:shadow-sm">
                  <button
                    onClick={() => handleView(d)}
                    disabled={loadingId === d.id}
                    className="text-left p-3 disabled:opacity-60 flex-1"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-ink text-sm">
                        {d.docType === 'aadhaar' ? 'Aadhaar' : 'Ration Card'} · {d.residentName}
                      </p>
                      {d.verified && (
                        <span className="text-[10px] bg-stamp-green/10 text-stamp-green px-2 py-0.5 rounded-full font-medium ml-2">Verified</span>
                      )}
                      {d.reuploadRequested && (
                        <span className="text-[10px] bg-stamp-red/10 text-stamp-red px-2 py-0.5 rounded-full font-medium ml-2 text-right">Re-upload Requested</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Signed: {d.consentSignatureName} · {new Date(d.uploadedAt).toLocaleDateString()}
                    </p>
                    {d.reuploadRequested && d.reuploadReason && (
                      <p className="text-xs text-stamp-red mt-1">Reason: {d.reuploadReason}</p>
                    )}
                    <p className="text-xs text-brand mt-1.5">
                      {loadingId === d.id ? 'Generating secure link…' : 'View document →'}
                    </p>
                  </button>
                  <div className="border-t border-brass/10 flex divide-x divide-brass/10">
                    <button 
                      onClick={() => handleVerify(d)}
                      disabled={actingId === d.id || d.verified}
                      className="flex-1 py-2 text-xs font-medium text-stamp-green hover:bg-stamp-green/5 disabled:opacity-50"
                    >
                      Verify ✓
                    </button>
                    <button 
                      onClick={() => handleRequestReupload(d)}
                      disabled={actingId === d.id}
                      className="flex-1 py-2 text-xs font-medium text-stamp-red hover:bg-stamp-red/5 disabled:opacity-50"
                    >
                      Request Re-upload
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
