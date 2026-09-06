import { useState } from 'react'
import { Download, Copy, Info } from 'lucide-react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useToast } from '../shared/ui/Toast'

export default function GoogleSheetsExport() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function fetchRentData() {
    setLoading(true)
    try {
      const q = query(collection(db, 'rentPayments'), orderBy('month', 'desc'))
      const snap = await getDocs(q)
      const data = snap.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          month: d.month || '',
          houseId: d.houseId || '',
          tenantName: d.recordedBy?.name || 'Unknown',
          amount: d.amount || 0,
          status: d.status || '',
          date: d.dateSent || '',
          mode: d.mode || '',
          applicationNumber: d.applicationNumber || d.id
        }
      })
      return data
    } catch (error) {
      console.error(error)
      toast.error('Failed to fetch data')
      return []
    } finally {
      setLoading(false)
    }
  }

  function generateCSV(data) {
    const headers = ['Month', 'House', 'Tenant Name', 'Rent Amount', 'Status', 'Payment Date', 'Mode', 'Application Number']
    const rows = data.map(d => [
      d.month,
      d.houseId,
      `"${d.tenantName}"`,
      d.amount,
      d.status,
      d.date,
      d.mode,
      d.applicationNumber
    ])
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }

  function generateTSV(data) {
    const headers = ['Month', 'House', 'Tenant Name', 'Rent Amount', 'Status', 'Payment Date', 'Mode', 'Application Number']
    const rows = data.map(d => [
      d.month,
      d.houseId,
      d.tenantName,
      d.amount,
      d.status,
      d.date,
      d.mode,
      d.applicationNumber
    ])
    return [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n')
  }

  async function handleDownloadCSV() {
    const data = await fetchRentData()
    if (!data.length) return
    const csv = generateCSV(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rent-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded successfully')
  }

  async function handleCopyTSV() {
    const data = await fetchRentData()
    if (!data.length) return
    const tsv = generateTSV(data)
    try {
      await navigator.clipboard.writeText(tsv)
      toast.success('Copied! You can now paste directly into Google Sheets.')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <h2 className="text-lg font-semibold text-ink">Google Sheets Export</h2>
        <p className="text-sm text-ink-soft">Export your rent payment data to CSV or paste it directly into Google Sheets.</p>
      </div>

      <div className="bg-paper-raised p-4 rounded-xl border border-brass/20 space-y-4 shadow-sm">
        <button
          onClick={handleDownloadCSV}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Download size={18} />
          {loading ? 'Fetching...' : 'Download CSV'}
        </button>

        <button
          onClick={handleCopyTSV}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-paper border border-brass/30 text-ink py-2.5 rounded-lg text-sm font-medium hover:bg-brass/5 disabled:opacity-50"
        >
          <Copy size={18} />
          {loading ? 'Fetching...' : 'Copy for Google Sheets (Paste Tab)'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
        <Info className="shrink-0" size={20} />
        <p>
          To auto-sync with Google Sheets in real-time, you can set up a Google Apps Script that receives webhooks from Firebase.
          <br /><a href="#" className="underline font-medium mt-1 inline-block">View setup documentation</a>
        </p>
      </div>
    </div>
  )
}
