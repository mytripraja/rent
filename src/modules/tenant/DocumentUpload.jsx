import { useEffect, useState } from 'react'
import { uploadResidentDocument, listDocumentsForHouse } from '../../services/documentService'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../shared/ui/Toast'

const CONSENT_TEXT = `I confirm the document I'm uploading belongs to a resident of this house and is accurate. I understand this is used only by the property owner for identity verification purposes, will not be shared with anyone else, and I can request its removal at any time by contacting the owner.`

export default function DocumentUpload() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [docs, setDocs] = useState([])
  const [form, setForm] = useState({ docType: 'aadhaar', residentName: '', signatureName: '', consentAccepted: false })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.houseId) refresh()
  }, [user])

  async function refresh() {
    try {
      setDocs(await listDocumentsForHouse(user.houseId))
    } catch (err) {
      console.error(err)
      showToast({ message: "Failed to load documents", type: "error" })
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!file || !form.consentAccepted || form.signatureName.trim().toLowerCase() !== form.residentName.trim().toLowerCase()) return
    setSaving(true)
    try {
      await uploadResidentDocument({
        houseId: user.houseId,
        tenantId: user.uid,
        docType: form.docType,
        residentName: form.residentName,
        file,
        signatureName: form.signatureName,
      })
      showToast({ message: "Document uploaded successfully", type: "success" })
      setForm({ docType: 'aadhaar', residentName: '', signatureName: '', consentAccepted: false })
      setFile(null)
      refresh()
    } catch (err) {
      console.error(err)
      showToast({ message: err.message || "Failed to upload document", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const signatureMatches =
    form.signatureName.trim().length > 0 &&
    form.signatureName.trim().toLowerCase() === form.residentName.trim().toLowerCase()

  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-ink">Document Verification</h3>
        <p className="text-xs text-ink-soft">Only visible to the owner — used for identity verification.</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm">
          <option value="aadhaar">Aadhaar Card</option>
          <option value="ration_card">Ration Card</option>
        </select>

        <input required placeholder="Resident's full name (as on the document)" value={form.residentName}
          onChange={(e) => setForm({ ...form, residentName: e.target.value })}
          className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />

        <input required type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])}
          className="w-full text-sm" />

        <div className="bg-paper rounded-lg p-3 text-xs text-ink-soft leading-relaxed">
          {CONSENT_TEXT}
        </div>

        <label className="flex items-start gap-2 text-xs text-ink-soft">
          <input type="checkbox" className="mt-0.5" checked={form.consentAccepted}
            onChange={(e) => setForm({ ...form, consentAccepted: e.target.checked })} />
          I have read and agree to the above.
        </label>

        <div>
          <label className="text-xs text-ink-soft">Type the resident's full name again as your signature</label>
          <input required value={form.signatureName} onChange={(e) => setForm({ ...form, signatureName: e.target.value })}
            className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 ${
              form.signatureName && !signatureMatches ? 'border-red-300' : 'border-brass/30'
            }`} />
          {form.signatureName && !signatureMatches && (
            <p className="text-xs text-red-500 mt-1">Must match the resident's name exactly.</p>
          )}
        </div>

        <button
          disabled={saving || !form.consentAccepted || !signatureMatches || !file}
          className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Uploading…' : 'Submit Document'}
        </button>
      </form>

      <div className="pt-2 border-t border-brass/15 space-y-1.5">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between text-xs text-ink-soft">
            <span>{d.docType === 'aadhaar' ? 'Aadhaar' : 'Ration Card'} · {d.residentName}</span>
            <span>{new Date(d.uploadedAt).toLocaleDateString()}</span>
          </div>
        ))}
        {docs.length === 0 && <p className="text-xs text-ink-soft">No documents uploaded yet.</p>}
      </div>
    </div>
  )
}
