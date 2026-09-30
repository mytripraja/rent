import { useMemo, useState } from 'react'
import { Copy, Download, Link2, Share2, X } from 'lucide-react'
import { buildHouseShareImage, buildHouseSharePdf, buildHouseShareText, shareHouseFile } from '../../services/houseShareService'
import { useToast } from '../shared/ui/Toast'

const DEFAULT_OPTIONS = {
  houseDetails: true,
  tenantName: false,
  tenantPhone: false,
  rent: false,
  advance: false,
  moveInDate: false,
  household: false,
  otherDetails: false,
  loginLink: false,
}

export default function HouseShareModal({ houses, onClose }) {
  const { showToast } = useToast()
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [format, setFormat] = useState('text')
  const [busy, setBusy] = useState(false)
  const rows = Array.isArray(houses) ? houses : []
  const text = useMemo(() => buildHouseShareText(rows, options), [rows, options])
  const title = rows.length === 1 ? `House ${rows[0]?.internalDoorNumber || ''} details` : `${rows.length} house details`

  function toggle(key) { setOptions(v => ({ ...v, [key]: !v[key] })) }
  async function download(file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function share() {
    setBusy(true)
    try {
      if (format === 'text') {
        if (navigator.share) await navigator.share({ title, text })
        else { await navigator.clipboard.writeText(text); showToast({ message: 'Text copied', type: 'success' }) }
      } else {
        const file = format === 'image' ? await buildHouseShareImage(rows, options) : await buildHouseSharePdf(rows, options)
        const shared = await shareHouseFile({ title, text, file, url: options.loginLink ? `${window.location.origin}/login` : null })
        if (!shared) { await download(file); showToast({ message: `${format.toUpperCase()} saved. This browser does not support file sharing.`, type: 'warning' }) }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') showToast({ message: e.message || 'Could not share house details', type: 'error' })
    } finally { setBusy(false) }
  }
  async function copy() { await navigator.clipboard.writeText(text); showToast({ message: 'House details copied', type: 'success' }) }

  return <div className="fixed inset-0 z-[90] bg-black/50 p-3 sm:p-6 grid place-items-center" role="dialog" aria-modal="true">
    <div className="w-full max-w-2xl max-h-[94vh] overflow-y-auto bg-paper-raised rounded-2xl shadow-2xl border border-brass/20 p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink">Share house details</h2><p className="text-xs text-ink-soft mt-1">Choose exactly which information can leave Rental Manager. Sensitive tenant details are off by default.</p></div><button onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center hover:bg-paper" aria-label="Close"><X size={18}/></button></div>
      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        {[
          ['houseDetails','House details','Door, floor, EB number and room counts'],
          ['tenantName','Tenant name','Current tenant name'],
          ['tenantPhone','Tenant phone','Current tenant phone number'],
          ['rent','Rent','Current monthly rent'],
          ['advance','Advance','Current advance amount'],
          ['moveInDate','Move-in date','Exact/approximate move-in date'],
          ['household','Household count','Number of people only'],
          ['otherDetails','Other house details','Owner notes and provided items'],
          ['loginLink','Tenant login link','Adds the Rental Manager login page link'],
        ].map(([key,label,hint]) => <label key={key} className="flex items-start gap-3 rounded-xl border border-[var(--rm-border)] bg-paper p-3 cursor-pointer"><input type="checkbox" checked={options[key]} onChange={() => toggle(key)} className="mt-1"/><span><b className="text-sm text-ink">{label}</b><span className="block text-xs text-ink-soft mt-0.5">{hint}</span></span></label>)}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">{[['text','Text'],['image','Image'],['pdf','PDF']].map(([id,label]) => <button key={id} onClick={() => setFormat(id)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${format===id?'border-brand bg-brand/10 text-brand':'border-brass/20 text-ink-soft'}`}>{label}</button>)}</div>
      <div className="mt-4 rounded-xl border border-brass/20 bg-paper p-4 whitespace-pre-wrap text-sm text-ink max-h-64 overflow-auto">{text}</div>
      <div className="grid sm:grid-cols-3 gap-2 mt-4"><button disabled={busy} onClick={share} className="rm-hero-button py-3 flex items-center justify-center gap-2 disabled:opacity-60"><Share2 size={17}/>{busy?'Preparing…':`Share ${format.toUpperCase()}`}</button><button onClick={copy} className="rm-secondary-button py-3 flex items-center justify-center gap-2"><Copy size={17}/>Copy text</button>{format!=='text' && <button disabled={busy} onClick={async()=>download(format==='image'?await buildHouseShareImage(rows,options):await buildHouseSharePdf(rows,options))} className="rm-secondary-button py-3 flex items-center justify-center gap-2"><Download size={17}/>Save file</button>}</div>
      {options.loginLink && <div className="mt-3 rounded-xl bg-brand/5 border border-brand/15 p-3 text-xs text-ink-soft flex gap-2"><Link2 size={15} className="text-brand shrink-0"/>Login link: {window.location.origin}/login</div>}
    </div>
  </div>
}
