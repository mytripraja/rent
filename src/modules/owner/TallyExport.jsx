import { useState } from 'react'
import { Download, Info } from 'lucide-react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useToast } from '../shared/ui/Toast'

export default function TallyExport() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function fetchRentData() {
    setLoading(true)
    try {
      const q = query(collection(db, 'rentPayments'), orderBy('month', 'desc'))
      const snap = await getDocs(q)
      return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(d => d.status === 'approved')
    } catch (error) {
      console.error(error)
      toast.error('Failed to fetch data')
      return []
    } finally {
      setLoading(false)
    }
  }

  function generateTallyXML(data) {
    const vouchers = data.map(payment => {
      const dateStr = payment.actionedAt ? new Date(payment.actionedAt).toISOString().split('T')[0].replace(/-/g, '') : (payment.dateSent?.replace(/-/g, '') || new Date().toISOString().split('T')[0].replace(/-/g, ''))
      const partyName = payment.recordedBy?.name || `Tenant_${payment.houseId}`
      const amount = payment.amount
      
      return `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${dateStr}</DATE>
          <NARRATION>Rent for ${payment.month} - House ${payment.houseId}</NARRATION>
          <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${payment.applicationNumber || payment.id}</VOUCHERNUMBER>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${partyName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${amount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Cash/Bank</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${amount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>
      `
    }).join('\n')

    return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        ${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
    `.trim()
  }

  async function handleDownloadXML() {
    const data = await fetchRentData()
    if (!data.length) return toast.info('No approved payments found.')
    
    const xml = generateTallyXML(data)
    const blob = new Blob([xml], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tally-receipts-${new Date().toISOString().split('T')[0]}.xml`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Tally XML downloaded successfully')
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <h2 className="text-lg font-semibold text-ink">Tally Export</h2>
        <p className="text-sm text-ink-soft">Export approved rent receipts as Tally XML vouchers.</p>
      </div>

      <div className="bg-paper-raised p-4 rounded-xl border border-brass/20 space-y-4 shadow-sm">
        <button
          onClick={handleDownloadXML}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Download size={18} />
          {loading ? 'Generating...' : 'Download Tally XML'}
        </button>
      </div>

      <div className="bg-paper border border-brass/30 p-4 rounded-xl space-y-2 text-sm text-ink-soft">
        <h3 className="font-semibold text-ink flex items-center gap-2"><Info size={16} /> How to import into Tally</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Download the XML file above.</li>
          <li>Ensure tenant ledgers exist in Tally with matching names.</li>
          <li>In Tally ERP 9 / Tally Prime, go to Import Data &gt; Vouchers.</li>
          <li>Enter the path to the downloaded XML file.</li>
        </ol>
      </div>
    </div>
  )
}
