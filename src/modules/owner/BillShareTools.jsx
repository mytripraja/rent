import { useMemo, useState } from 'react'

function money(v) { return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` }

export default function BillShareTools({ bill, houses = [], billType = 'Water', onClose }) {
  const shares = Array.isArray(bill?.shares) ? bill.shares : []
  const [scope, setScope] = useState('all-basic')
  const [selected, setSelected] = useState([])
  const [includeNote, setIncludeNote] = useState(true)
  const [customNote, setCustomNote] = useState('')
  const rows = useMemo(() => shares.map(s => {
    const h = houses.find(x => x.id === s.houseId) || {}
    return { ...s, tenantName: h.tenantName || h.name || 'Resident', houseLabel: s.internalDoorNumber || h.internalDoorNumber || h.govtDoorNumber || s.houseId }
  }), [shares, houses])
  const chosen = scope === 'one' ? rows.filter(r => selected.includes(r.houseId)).slice(0,1) : scope === 'multiple' ? rows.filter(r => selected.includes(r.houseId)) : rows
  const detailed = scope === 'all-detailed' || scope === 'one'
  const billTypeKey = String(billType || '').toLowerCase() === 'eb' ? 'eb' : 'water'
  const portalLink = `${window.location.origin}/tenant?billType=${billTypeKey}&billId=${encodeURIComponent(bill?.id || '')}`
  const message = useMemo(() => {
    const lines = [`${billType} bill: ${bill?.cycleLabel || ''}`, `Total bill: ${money(bill?.totalAmount)}`, `Due date: ${bill?.dueDate || 'Not specified'}`]
    if (includeNote && bill?.note) lines.push(`Owner note: ${bill.note}`)
    if (customNote.trim()) lines.push(`Note: ${customNote.trim()}`)
    if (detailed) {
      lines.push('', 'House-wise details:')
      chosen.forEach(r => lines.push(`${r.tenantName} · House ${r.houseLabel} · Share ${money(r.shareAmount)}`))
    } else lines.push(`House-wise individual shares are available after signing in.`)
    lines.push('', `View your bill / sign in: ${portalLink}`, 'Please use your registered tenant account to view your exact share and submit payment proof. A payment is not marked paid until the owner verifies it.')
    return lines.join('\n')
  }, [bill, billType, chosen, customNote, detailed, includeNote, portalLink])
  const selectedRequired = (scope === 'one' || scope === 'multiple') && !chosen.length
  function shareTo(kind) {
    if (selectedRequired) return
    const encoded = encodeURIComponent(message)
    if (kind === 'whatsapp') window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
    else if (kind === 'email') window.location.href = `mailto:?subject=${encodeURIComponent(`${billType} bill - ${bill?.cycleLabel || ''}`)}&body=${encoded}`
    else if (kind === 'link') { navigator.clipboard?.writeText(portalLink).then(() => alert('Specific bill link copied.')).catch(() => alert(portalLink)) }
    else if (kind === 'copy') { navigator.clipboard?.writeText(message).then(() => alert('Bill details copied.')).catch(() => alert(message)) }
    else if (navigator.share) navigator.share({ title: `${billType} bill`, text: message }).catch(() => {})
    else window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
  }
  return <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Share ${billType} bill`}>
    <div className="bg-paper-raised rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">Share {billType} bill</h3><p className="text-xs text-ink-soft mt-1">{bill?.cycleLabel} · Total {money(bill?.totalAmount)}</p></div><button type="button" onClick={onClose} className="border rounded-lg px-3 py-1.5 text-sm">Close</button></div>
      <div className="space-y-2 text-sm">
        <label className="block text-xs font-medium text-ink-soft">Who do you want to share with?</label>
        <select value={scope} onChange={e => {setScope(e.target.value); setSelected([])}} className="w-full border border-brass/30 rounded-lg px-3 py-2 bg-paper">
          <option value="all-basic">All residents — basic details only</option><option value="all-detailed">All residents — all house shares</option><option value="one">One resident / house</option><option value="multiple">Selected residents — basic details</option>
        </select>
        {(scope === 'one' || scope === 'multiple') && <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">{rows.map(r => <label key={r.houseId} className="flex items-center gap-2"><input type={scope === 'one' ? 'radio' : 'checkbox'} name="share-house" checked={selected.includes(r.houseId)} onChange={e => setSelected(scope === 'one' ? (e.target.checked ? [r.houseId] : []) : (e.target.checked ? [...selected, r.houseId] : selected.filter(id => id !== r.houseId)))} /><span>{r.tenantName} · House {r.houseLabel} · {money(r.shareAmount)}</span></label>)}</div>}
        {scope === 'all-basic' && <p className="text-xs text-ink-soft">Shares and personal details are not listed in the message. Each resident should sign in to see their own exact amount.</p>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includeNote} onChange={e => setIncludeNote(e.target.checked)} /> Include owner note{bill?.note ? `: ${bill.note}` : ' (none added)'}</label>
        <textarea value={customNote} onChange={e => setCustomNote(e.target.value)} rows={2} placeholder="Optional note to include in this share" className="w-full border border-brass/30 rounded-lg px-3 py-2 text-sm" />
      </div>
      {selectedRequired && <p className="text-xs text-red-600">Select at least one house before sharing.</p>}
      <div className="space-y-2"><label className="block text-xs font-medium text-ink-soft">Specific secure link for this bill</label><div className="flex gap-2"><input readOnly value={portalLink} className="min-w-0 flex-1 border border-brass/30 rounded-lg px-3 py-2 text-xs bg-paper" onFocus={e => e.target.select()} /><button type="button" onClick={() => shareTo('link')} className="border rounded-lg px-3 py-2 text-xs">Copy link</button></div><p className="text-[11px] text-ink-soft">Residents must sign in with their own registered account. The link identifies this bill only; the server-side house/account access still controls which share they can see.</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><button type="button" onClick={() => shareTo('whatsapp')} className="bg-green-600 text-white rounded-lg py-2 text-sm">WhatsApp</button><button type="button" onClick={() => shareTo('email')} className="bg-brand text-white rounded-lg py-2 text-sm">Email</button><button type="button" onClick={() => shareTo('other')} className="border rounded-lg py-2 text-sm">Share…</button><button type="button" onClick={() => shareTo('copy')} className="border rounded-lg py-2 text-sm">Copy details</button></div>
      <p className="text-[11px] text-ink-soft">The payment page shows the logged-in resident’s calculated share and lets them submit payment proof. The owner must verify proof before marking a payment as paid. No public house-number/name-only access is enabled, to protect tenant billing information.</p>
    </div>
  </div>
}
