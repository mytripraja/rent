import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { listHouses } from '../../services/houseService'
import { useToast } from '../shared/ui/Toast'

// Escapes text before it's interpolated into an HTML string. This report is
// built from tenant- and owner-entered data (names, complaint messages) and
// then rendered with dangerouslySetInnerHTML for the print-style preview —
// without escaping, a tenant putting HTML/script content in a complaint
// message would execute in the OWNER's authenticated browser session when
// they view this report. Every dynamic value below must go through this.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function EmailReport() {
  const [html, setHtml] = useState('')
  const [summaryText, setSummaryText] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    generateReport()
  }, [])

  async function generateReport() {
    setLoading(true)
    try {
      const houses = await listHouses()
      const rentSnap = await getDocs(collection(db, 'rentPayments'))
      const allRents = rentSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const complaintsSnap = await getDocs(collection(db, 'complaints'))
      const complaints = complaintsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM

      const rentsThisMonth = allRents.filter(r => r.month === currentMonth)
      let expected = 0
      let collected = 0

      houses.forEach(h => {
        if (h.status === 'occupied') {
          expected += Number(h.rentAmount || 0)
        }
      })

      rentsThisMonth.forEach(r => {
        if (r.status === 'approved') {
          collected += Number(r.amount || 0)
        }
      })

      const pendingRents = houses.filter(h => h.status === 'occupied' && !rentsThisMonth.some(r => r.houseId === h.id && r.status === 'approved'))
      const openComplaints = complaints.filter(c => c.status !== 'resolved')

      // Every dynamic value is escaped before going into the HTML string —
      // tenant names, complaint messages, and door numbers are all user-
      // or owner-entered data, not trusted markup.
      let reportHtml = `
        <div style="font-family: sans-serif; color: #2b2620; max-width: 600px; margin: 0 auto; background: #fbf8ef; padding: 20px; border-radius: 8px;">
          <h2 style="color: #5b2a2a;">Monthly Rental Report - ${escapeHtml(currentMonth)}</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #b8873d;">Collection Summary</h3>
            <p><strong>Expected:</strong> ₹${escapeHtml(expected)}</p>
            <p><strong>Collected:</strong> ₹${escapeHtml(collected)}</p>
            <p><strong>Pending:</strong> ₹${escapeHtml(expected - collected)}</p>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #a63a32;">Pending Tenants (${pendingRents.length})</h3>
            <ul>
              ${pendingRents.map(h => `<li>House ${escapeHtml(h.internalDoorNumber)} (${escapeHtml(h.tenantName)})</li>`).join('')}
            </ul>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #b8873d;">Open Complaints (${openComplaints.length})</h3>
            <ul>
              ${openComplaints.map(c => `<li>${escapeHtml(c.message)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `
      setHtml(reportHtml)

      const text = `Monthly Rental Report - ${currentMonth}
Expected: ₹${expected}
Collected: ₹${collected}
Pending: ₹${expected - collected}

Pending Houses: ${pendingRents.map(h => h.internalDoorNumber).join(', ')}
Open Complaints: ${openComplaints.length}`

      setSummaryText(text)
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(html)
    toast.success('HTML copied to clipboard')
  }

  function handleSend() {
    window.location.href = `mailto:?subject=Monthly Rental Report&body=${encodeURIComponent(summaryText)}`
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Email Report</h2>
      
      {loading ? (
        <p className="text-sm text-ink-soft">Generating...</p>
      ) : (
        <div className="space-y-4">
          <div className="bg-paper border border-brass/20 rounded-xl p-4 overflow-auto max-h-64 shadow-inner">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          
          <div className="flex gap-3">
            <button onClick={handleCopy} className="flex-1 bg-paper border border-brass/30 text-ink py-2 rounded-lg text-sm font-medium">
              Copy HTML
            </button>
            <button onClick={handleSend} className="flex-1 bg-cover text-white py-2 rounded-lg text-sm font-medium">
              Send via Email
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
