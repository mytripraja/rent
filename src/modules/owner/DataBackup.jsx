import { useState, useEffect } from 'react'
import { useToast } from '../shared/ui/Toast'
import { listHouses, listPastTenants } from '../../services/houseService'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'

export default function DataBackup() {
  const toast = useToast()
  const [lastExport, setLastExport] = useState(localStorage.getItem('last_backup_date') || 'Never')

  async function handleExportJSON() {
    try {
      const houses = await listHouses()
      const tenants = await listPastTenants()
      
      const rentsSnap = await getDocs(collection(db, 'rentPayments'))
      const rents = rentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      const ebSnap = await getDocs(collection(db, 'ebBills'))
      const ebBills = ebSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      const data = { houses, tenants, rents, ebBills }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().split('T')[0]
      a.download = `rental-manager-backup-${dateStr}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      localStorage.setItem('last_backup_date', dateStr)
      setLastExport(dateStr)
      toast.success('Backup exported successfully')
    } catch (e) {
      console.error(e)
      toast.error('Export failed')
    }
  }

  async function handleExportCSV() {
    try {
      const rentsSnap = await getDocs(collection(db, 'rentPayments'))
      const rents = rentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      let csv = 'House ID,Tenant ID,Month,Amount,Status,Date\n'
      rents.forEach(r => {
        csv += `${r.houseId},${r.tenantId || ''},${r.month},${r.amount},${r.status},${r.dateSent || r.submittedAt}\n`
      })
      
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rent-payments.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('CSV exported successfully')
    } catch (e) {
      console.error(e)
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Data Backup</h2>
      <div className="bg-paper-raised p-5 rounded-xl border border-brass/20 shadow-sm space-y-4">
        <p className="text-sm text-ink-soft">
          Download a full backup of all your houses, tenants, rent payments, and EB bills in JSON format.
        </p>
        <p className="text-xs text-ink-soft/80">Last backup: {lastExport}</p>
        
        <div className="flex gap-3">
          <button onClick={handleExportJSON} className="flex-1 bg-cover text-white py-2 rounded-lg text-sm font-medium">
            Export All Data (JSON)
          </button>
          <button onClick={handleExportCSV} className="flex-1 bg-paper border border-brass/30 text-ink py-2 rounded-lg text-sm font-medium">
            Export Rents (CSV)
          </button>
        </div>
        
        <div className="mt-4 p-3 bg-stamp-amber/10 rounded-lg text-xs text-ink-soft">
          <strong>Note on automated backups:</strong> To set up automated daily backups, consider configuring Google Cloud Storage exports in your Firebase project settings.
        </div>
      </div>
    </div>
  )
}
