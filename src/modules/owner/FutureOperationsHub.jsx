import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, BarChart3, BellRing, Building2, Calculator, Boxes,
  BrainCircuit, BriefcaseBusiness, CalendarClock, CarFront, CheckCircle2, ClipboardList,
  Cloud, DatabaseBackup, FileArchive, FileText, HardDrive, KeyRound, Landmark, LockKeyhole,
  Mail, MessageSquare, Package, Plus, RefreshCw, Search, ShieldCheck, ShoppingCart,
  Siren, Sparkles, Trash2, TrendingUp, UsersRound, WalletCards, Wrench, X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getProperties } from '../../services/configService'
import { listHouses } from '../../services/houseService'
import { createAccountingJournal, createRecord, deleteRecord, exportCollections, listRecords, updateRecord } from '../../services/enterpriseService'
import { createBulkNotifications } from '../../services/notificationService'
import { collection, getDocs, where, query } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { logActivity } from '../../services/activityLogService'
import { useToast } from '../shared/ui/Toast'

const TABS = [
  ['hierarchy', 'Hierarchy', Building2],
  ['accounting', 'Accounting', Calculator],
  ['maintenance', 'Maintenance Work Orders', Wrench],
  ['preventive', 'Preventive Maintenance', CalendarClock],
  ['inventory', 'Inventory', Boxes],
  ['purchases', 'Purchasing', ShoppingCart],
  ['security', 'Visitors & Security', ShieldCheck],
  ['parcels', 'Parcels', Package],
  ['documents', 'Documents', FileText],
  ['leases', 'Leases', ClipboardList],
  ['utilities', 'Utility Billing', ZapIcon],
  ['investor', 'Owner / Investor', WalletCards],
  ['analytics', 'Advanced Analytics', BarChart3],
  ['ai', 'AI Assistant', BrainCircuit],
  ['communication', 'Communication', MessageSquare],
  ['audit', 'Audit & Security', LockKeyhole],
  ['backup', 'Backup & Recovery', DatabaseBackup],
  ['integrations', 'API & Integrations', BriefcaseBusiness],
]

function ZapIcon(props) { return <Activity {...props} /> }

const money = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)

function Field({ label, value, onChange, type = 'text', options, placeholder }) {
  return <label className="block text-sm">
    <span className="block font-semibold text-ink mb-1">{label}</span>
    {options ? <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-[var(--rm-border)] bg-paper-raised px-3 py-2.5">{options.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select> :
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-[var(--rm-border)] bg-paper-raised px-3 py-2.5" />}
  </label>
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-[70] bg-black/40 p-3 sm:p-6 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
    <div className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-3xl bg-paper-raised shadow-2xl border border-[var(--rm-border)]">
      <div className="sticky top-0 bg-paper-raised/95 backdrop-blur px-5 py-4 border-b border-[var(--rm-border)] flex items-center justify-between">
        <h3 className="font-display text-lg font-extrabold">{title}</h3>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-paper" aria-label="Close"><X size={18}/></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
}

function Empty({ text }) { return <div className="rounded-2xl border border-dashed border-[var(--rm-border)] p-8 text-center text-sm text-ink-soft">{text}</div> }

export default function FutureOperationsHub() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('accounting')
  const [propertyId, setPropertyId] = useState(localStorage.getItem('rm_active_property') || 'default')
  const [properties, setProperties] = useState([])
  const [houses, setHouses] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [props, hs] = await Promise.all([getProperties(), listHouses(propertyId)])
      setProperties(props || [])
      setHouses(hs || [])
      const collection = tab === 'hierarchy' ? 'societyHierarchy'
        : tab === 'accounting' ? 'accountingTransactions'
        : tab === 'maintenance' ? 'maintenanceWorkOrders'
        : tab === 'preventive' ? 'preventiveMaintenance'
        : tab === 'inventory' ? 'inventoryItems'
        : tab === 'purchases' ? 'purchaseOrders'
        : tab === 'security' ? 'securityEvents'
        : tab === 'parcels' ? 'parcels'
        : tab === 'documents' ? 'documentRegistry'
        : tab === 'leases' ? 'leaseRecords'
        : tab === 'utilities' ? 'utilityBills'
        : tab === 'investor' ? 'ownerInvestments'
        : tab === 'communication' ? 'communicationMessages'
        : tab === 'backup' ? 'backupPlans'
        : tab === 'integrations' ? 'apiIntegrations'
        : tab === 'audit' ? 'activityLog'
        : tab === 'maintenance' ? 'maintenanceWorkOrders' : null
      if (collection) setRows(collection === 'activityLog' ? await listRecords(collection) : await listRecords(collection, propertyId))
      else setRows([])
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Could not load module')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab, propertyId])

  const visibleRows = useMemo(() => rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())), [rows, search])
  const currentProperty = properties.find(p => p.id === propertyId)

  async function save(collectionName, data) {
    try {
      if (collectionName === 'accountingTransactions' && data.debitAccount && data.creditAccount) {
        await createAccountingJournal({ ...data, propertyId, createdBy: user?.uid || null })
      } else {
        const created = await createRecord(collectionName, { ...data, propertyId, createdBy: user?.uid || null })
        await logActivity({ action: 'created', entityType: collectionName, entityId: created.id, performedBy: user?.uid || null, performedByName: user?.name || 'Owner', details: `Created ${collectionName} record in ${currentProperty?.name || propertyId}` }).catch(() => {})

        // In-app delivery for resident-facing operational events.
        if (['communicationMessages', 'parcels', 'securityEvents'].includes(collectionName)) {
          const houseIds = data.houseId ? [data.houseId] : houses.map(h => h.id)
          const userSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'tenant')))
          const targets = userSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => houseIds.includes(u.houseId))
          if (collectionName === 'communicationMessages' && data.message) {
            await createBulkNotifications(targets.map(t => ({ recipientId: t.id, recipientType: 'tenant', type: 'message_received', title: data.title || 'New apartment message', message: data.message, metadata: { propertyId, communicationId: created.id } })))
          } else if (collectionName === 'parcels') {
            await createBulkNotifications(targets.map(t => ({ recipientId: t.id, recipientType: 'tenant', type: 'message_received', title: 'Parcel received', message: `${data.courier || 'A courier'} parcel ${data.trackingNo ? `(${data.trackingNo}) ` : ''}was recorded for your house.`, metadata: { propertyId, parcelId: created.id } })))
          } else if (collectionName === 'securityEvents' && data.eventType === 'visitor' && data.houseId) {
            await createBulkNotifications(targets.map(t => ({ recipientId: t.id, recipientType: 'tenant', title: 'Visitor recorded', type: 'message_received', message: `${data.personName || 'A visitor'} was recorded at the apartment gate.`, metadata: { propertyId, securityEventId: created.id } })))
          }
        }

        // Completing a maintenance job with a cost also posts the expense to the
        // double-entry ledger, so operations and accounting stay connected.
        if (collectionName === 'maintenanceWorkOrders' && data.status === 'completed' && Number(data.cost) > 0) {
          await createAccountingJournal({
            propertyId, createdBy: user?.uid || null, amount: Number(data.cost),
            description: `Maintenance: ${data.title || 'Work order'}`,
            debitAccount: 'Maintenance Expense', creditAccount: 'Cash / Payable',
            category: 'Maintenance', houseId: data.houseId || null
          }).catch(() => {})
        }

        // A received PO can optionally increase an existing inventory item.
        if (collectionName === 'purchaseOrders' && data.status === 'received' && data.inventoryItemId && Number(data.receivedQuantity) > 0) {
          const item = (await listRecords('inventoryItems', propertyId)).find(x => x.id === data.inventoryItemId)
          if (item) await updateRecord('inventoryItems', item.id, { quantity: Number(item.quantity || 0) + Number(data.receivedQuantity) })
        }
      }
      setModal(null)
      await load()
      toast.success('Saved successfully')
    } catch (e) { toast.error(e.message || 'Save failed') }
  }

  async function remove(collectionName, id) {
    if (!window.confirm('Delete this record?')) return
    try { await deleteRecord(collectionName, id); await logActivity({ action: 'deleted', entityType: collectionName, entityId: id, performedBy: user?.uid || null, performedByName: user?.name || 'Owner', details: `Deleted ${collectionName} record` }).catch(() => {}); await load(); toast.success('Deleted') } catch (e) { toast.error(e.message || 'Delete failed') }
  }

  const addButton = (label, type) => <button onClick={() => setModal(type)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><Plus size={16}/>{label}</button>

  return <div className="space-y-5">
    <div className="rm-card p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div><div className="rm-kicker">Operations ERP</div><h2 className="font-display text-2xl sm:text-3xl font-extrabold mt-1">Apartment Operations Hub</h2><p className="text-sm text-ink-soft mt-1">Advanced modules are stored separately by apartment so your local property stays simple while the system can grow later.</p></div>
        <div className="flex items-center gap-2">
          <select value={propertyId} onChange={e => { setPropertyId(e.target.value); localStorage.setItem('rm_active_property', e.target.value) }} className="rounded-xl border border-[var(--rm-border)] bg-paper-raised px-3 py-2.5 text-sm font-semibold">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button onClick={load} className="p-2.5 rounded-xl border border-[var(--rm-border)]" aria-label="Refresh"><RefreshCw size={17}/></button>
        </div>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this apartment module…" className="flex-1 rounded-xl border border-[var(--rm-border)] bg-paper-raised px-3 py-2.5 text-sm" aria-label="Search current module" />
        {loading && <span className="self-center text-xs text-ink-soft">Loading…</span>}
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Operations modules">
        {TABS.map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${tab === id ? 'bg-brand text-white' : 'bg-paper text-ink-soft border border-[var(--rm-border)]'}`}><Icon size={15}/>{label}</button>)}
      </div>
    </div>

    {tab === 'hierarchy' && <Hierarchy properties={properties} rows={visibleRows} addButton={addButton} save={save} remove={remove} />}
    {tab === 'accounting' && <Accounting rows={visibleRows} houses={houses} addButton={addButton} save={save} remove={remove} />}
    {tab === 'maintenance' && <Maintenance rows={visibleRows} houses={houses} addButton={addButton} remove={remove} />}
    {tab === 'preventive' && <Preventive rows={visibleRows} houses={houses} addButton={addButton} remove={remove} />}
    {tab === 'inventory' && <Inventory rows={visibleRows} addButton={addButton} remove={remove} />}
    {tab === 'purchases' && <Purchases rows={visibleRows} addButton={addButton} remove={remove} />}
    {tab === 'security' && <Security rows={visibleRows} houses={houses} addButton={addButton} save={save} remove={remove} />}
    {tab === 'parcels' && <Parcels rows={visibleRows} houses={houses} addButton={addButton} save={save} remove={remove} />}
    {tab === 'documents' && <Documents rows={visibleRows} houses={houses} addButton={addButton} save={save} remove={remove} />}
    {tab === 'leases' && <Leases rows={visibleRows} houses={houses} addButton={addButton} save={save} remove={remove} />}
    {tab === 'utilities' && <Utilities rows={visibleRows} houses={houses} addButton={addButton} save={save} remove={remove} />}
    {tab === 'investor' && <Investor rows={visibleRows} addButton={addButton} save={save} remove={remove} />}
    {tab === 'analytics' && <Analytics houses={houses} />}
    {tab === 'ai' && <AIAssistant houses={houses} />}
    {tab === 'communication' && <Communication rows={visibleRows} addButton={addButton} save={save} remove={remove} />}
    {tab === 'audit' && <Audit rows={visibleRows} />}
    {tab === 'backup' && <Backup rows={visibleRows} properties={properties} save={save} />}
    {tab === 'integrations' && <Integrations rows={visibleRows} addButton={addButton} save={save} remove={remove} />}

    {search && null}
    {modal && <CreateModal type={modal} houses={houses} properties={properties} onClose={() => setModal(null)} onSave={save} />}
  </div>
}

function ModuleHeader({ icon: Icon, title, desc, action }) { return <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div className="flex gap-3 items-center"><span className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center"><Icon size={21}/></span><div><h3 className="font-display text-xl font-extrabold">{title}</h3><p className="text-xs text-ink-soft">{desc}</p></div></div>{action}</div> }
function Table({ columns, rows, onDelete }) { return rows.length ? <div className="overflow-x-auto rounded-2xl border border-[var(--rm-border)]"><table className="w-full text-sm"><thead><tr className="bg-paper">{columns.map(c => <th key={c.key} className="text-left px-4 py-3 text-xs uppercase tracking-wide text-ink-soft">{c.label}</th>)}{onDelete && <th/>}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-[var(--rm-border)]">{columns.map(c => <td key={c.key} className="px-4 py-3 align-top">{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}{onDelete && <td className="px-3"><button onClick={() => onDelete(r.id)} className="p-2 text-red-600" aria-label="Delete"><Trash2 size={15}/></button></td>}</tr>)}</tbody></table></div> : <Empty text="No records yet for this apartment." /> }

function Hierarchy({ properties, rows, addButton, save, remove }) { return <div className="space-y-4"><ModuleHeader icon={Building2} title="Future Society / Building Hierarchy" desc="Optional structure for society → building → floor → unit. It does not change your local-apartment workflow." action={addButton('Add level','hierarchy')}/><div className="rm-card p-4 bg-amber-50/50"><div className="flex gap-3"><Sparkles className="text-amber-600"/><div className="text-sm"><b>Local mode stays simple.</b> Keep one apartment as the active property today. If you later manage multiple blocks/buildings, this module is ready for the hierarchy without merging their data.</div></div></div><Table rows={rows} onDelete={id => remove('societyHierarchy',id)} columns={[{key:'levelType',label:'Level'},{key:'name',label:'Name'},{key:'parentName',label:'Parent'},{key:'notes',label:'Notes'}]} /></div> }

function Accounting({ rows, houses, addButton, remove }) { const debit=rows.reduce((a,r)=>a+Number(r.debit||0),0); const credit=rows.reduce((a,r)=>a+Number(r.credit||0),0); const legacyIncome=rows.filter(r=>r.kind==='income' && !r.debit).reduce((a,r)=>a+Number(r.amount||0),0); const legacyExpense=rows.filter(r=>r.kind==='expense' && !r.debit).reduce((a,r)=>a+Number(r.amount||0),0); const balanced=Math.abs(debit-credit)<0.01; return <div className="space-y-4"><ModuleHeader icon={Calculator} title="Full Accounting" desc="Double-entry journal lines plus legacy income/expense records, property ledger and audit trail." action={addButton('New journal entry','accounting')}/><div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Kpi label="Debit" value={money(debit)}/><Kpi label="Credit" value={money(credit)}/><Kpi label="Balance" value={balanced?'Balanced':'Check ledger'}/><Kpi label="Legacy income" value={money(legacyIncome)}/><Kpi label="Legacy expense" value={money(legacyExpense)}/></div><div className="rm-card p-4 text-xs text-ink-soft">Every new journal entry creates equal debit and credit lines. Existing rent/expense records remain visible for compatibility.</div><Table rows={rows} onDelete={id=>remove('accountingTransactions',id)} columns={[{key:'date',label:'Date'},{key:'account',label:'Account',render:r=>r.account||r.category||'—'},{key:'description',label:'Description'},{key:'debit',label:'Debit',render:r=>r.debit?money(r.debit):'—'},{key:'credit',label:'Credit',render:r=>r.credit?money(r.credit):'—'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'Property'}]} /></div> }

function Maintenance({ rows, houses, addButton, remove }) { const open=rows.filter(r=>!['completed','cancelled'].includes(r.status)).length; return <div className="space-y-4"><ModuleHeader icon={Wrench} title="Maintenance + Preventive Maintenance" desc="Work orders, priority, SLA, vendors, repair cost and recurring service schedules." action={addButton('New work order','maintenance')}/><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="Open work" value={open}/><Kpi label="Completed" value={rows.filter(r=>r.status==='completed').length}/><Kpi label="High priority" value={rows.filter(r=>r.priority==='high').length}/><Kpi label="Preventive" value={rows.filter(r=>r.preventive).length}/></div><Table rows={rows} onDelete={id=>remove('maintenanceWorkOrders',id)} columns={[{key:'title',label:'Work'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'Property'},{key:'priority',label:'Priority'},{key:'status',label:'Status'},{key:'dueDate',label:'Due'},{key:'vendor',label:'Vendor'}]} /></div> }

function Preventive({ rows, houses, addButton, remove }) { return <div className="space-y-4"><ModuleHeader icon={CalendarClock} title="Preventive Maintenance" desc="Recurring schedules for pumps, tanks, CCTV, generators, lifts, fire equipment and other assets." action={addButton('Add schedule','preventive')}/><Table rows={rows} onDelete={id=>remove('preventiveMaintenance',id)} columns={[{key:'asset',label:'Asset'},{key:'frequencyDays',label:'Every' ,render:r=>`${r.frequencyDays||30} days`},{key:'nextRun',label:'Next run'},{key:'vendor',label:'Vendor'},{key:'autoCreate',label:'Auto work order',render:r=>r.autoCreate?'Yes':'No'},{key:'lastRun',label:'Last run'}]} /></div> }

function Purchases({ rows, addButton, remove }) { const total=rows.reduce((a,r)=>a+Number(r.total||0),0); return <div className="space-y-4"><ModuleHeader icon={ShoppingCart} title="Purchasing" desc="Supplier quotations, purchase orders, approvals, received items and invoice references." action={addButton('New purchase order','purchases')}/><div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Kpi label="Orders" value={rows.length}/><Kpi label="Order value" value={money(total)}/><Kpi label="Open" value={rows.filter(r=>!['received','cancelled'].includes(r.status)).length}/></div><Table rows={rows} onDelete={id=>remove('purchaseOrders',id)} columns={[{key:'poNumber',label:'PO'},{key:'supplier',label:'Supplier'},{key:'orderDate',label:'Date'},{key:'total',label:'Total',render:r=>money(r.total)},{key:'status',label:'Status'},{key:'invoiceRef',label:'Invoice'}]} /></div> }

function Inventory({ rows, addButton, remove }) { const low=rows.filter(r=>Number(r.quantity||0)<=Number(r.reorderLevel||0)).length; return <div className="space-y-4"><ModuleHeader icon={Boxes} title="Purchase & Inventory" desc="Stock, reorder levels, suppliers, purchase references, serial numbers and issue tracking." action={addButton('Add stock item','inventory')}/><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="Items" value={rows.length}/><Kpi label="Low stock" value={low}/><Kpi label="Units" value={rows.reduce((a,r)=>a+Number(r.quantity||0),0)}/><Kpi label="Stock value" value={money(rows.reduce((a,r)=>a+Number(r.quantity||0)*Number(r.unitCost||0),0))}/></div><Table rows={rows} onDelete={id=>remove('inventoryItems',id)} columns={[{key:'name',label:'Item'},{key:'sku',label:'SKU'},{key:'quantity',label:'Qty'},{key:'reorderLevel',label:'Reorder at'},{key:'supplier',label:'Supplier'},{key:'unitCost',label:'Unit cost',render:r=>money(r.unitCost)}]} /></div> }

function Security({ rows, houses, addButton, remove }) { return <div className="space-y-4"><ModuleHeader icon={ShieldCheck} title="Visitors + Security" desc="Gate events, guest approvals, staff/contractor entry, vehicles and incidents." action={addButton('Record gate event','security')}/><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="Today" value={rows.filter(r=>r.date===today()).length}/><Kpi label="Visitors" value={rows.filter(r=>r.eventType==='visitor').length}/><Kpi label="Incidents" value={rows.filter(r=>r.eventType==='incident').length}/><Kpi label="Vehicles" value={rows.filter(r=>r.vehicleNo).length}/></div><Table rows={rows} onDelete={id=>remove('securityEvents',id)} columns={[{key:'date',label:'Date'},{key:'eventType',label:'Type'},{key:'personName',label:'Person'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'Gate'},{key:'vehicleNo',label:'Vehicle'},{key:'status',label:'Status'}]} /></div> }

function Parcels({ rows, houses, addButton, remove }) { return <div className="space-y-4"><ModuleHeader icon={Package} title="Parcel & Delivery Management" desc="Courier intake, resident notification, pickup confirmation and delivery history." action={addButton('Record parcel','parcel')}/><Table rows={rows} onDelete={id=>remove('parcels',id)} columns={[{key:'receivedAt',label:'Received'},{key:'courier',label:'Courier'},{key:'trackingNo',label:'Tracking'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'—'},{key:'status',label:'Status'},{key:'pickedUpAt',label:'Picked up'}]} /></div> }

function Documents({ rows, houses, addButton, remove }) { const exp=rows.filter(r=>r.expiryDate && r.expiryDate<today()).length; return <div className="space-y-4"><ModuleHeader icon={FileText} title="Digital Document Management" desc="Document registry with owner, category, expiry, renewal reminder and secure file reference." action={addButton('Register document','documents')}/><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi label="Documents" value={rows.length}/><Kpi label="Expired" value={exp}/><Kpi label="Expiring soon" value={rows.filter(r=>r.expiryDate && r.expiryDate>=today() && r.expiryDate<=new Date(Date.now()+30*86400000).toISOString().slice(0,10)).length}/><Kpi label="With file" value={rows.filter(r=>r.fileRef).length}/></div><Table rows={rows} onDelete={id=>remove('documentRegistry',id)} columns={[{key:'name',label:'Document'},{key:'category',label:'Category'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'Property'},{key:'expiryDate',label:'Expiry'},{key:'fileRef',label:'File reference'}]} /></div> }

function Leases({ rows, houses, addButton, remove }) { return <div className="space-y-4"><ModuleHeader icon={ClipboardList} title="Lease Management" desc="Lease dates, deposit, escalation, notice period, renewal and move-in/out checkpoints." action={addButton('New lease','leases')}/><Table rows={rows} onDelete={id=>remove('leaseRecords',id)} columns={[{key:'tenantName',label:'Tenant'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'—'},{key:'startDate',label:'Start'},{key:'endDate',label:'End'},{key:'rent',label:'Rent',render:r=>money(r.rent)},{key:'deposit',label:'Deposit',render:r=>money(r.deposit)},{key:'status',label:'Status'}]} /></div> }

function Utilities({ rows, houses, addButton, remove }) { const total=rows.reduce((a,r)=>a+Number(r.amount||0),0); return <div className="space-y-4"><ModuleHeader icon={Activity} title="Utility Billing Engine" desc="Meter readings and bills for electricity, water, gas, generator, solar or custom utilities." action={addButton('New utility bill','utilities')}/><div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Kpi label="Bills" value={rows.length}/><Kpi label="Total billed" value={money(total)}/><Kpi label="Meters recorded" value={rows.filter(r=>r.currentReading!==undefined).length}/></div><Table rows={rows} onDelete={id=>remove('utilityBills',id)} columns={[{key:'utilityType',label:'Utility'},{key:'houseId',label:'Unit',render:r=>houses.find(h=>h.id===r.houseId)?.internalDoorNumber||'Property'},{key:'previousReading',label:'Previous'},{key:'currentReading',label:'Current'},{key:'consumption',label:'Usage'},{key:'amount',label:'Amount',render:r=>money(r.amount)},{key:'dueDate',label:'Due'}]} /></div> }

function Investor({ rows, addButton, remove }) { const invested=rows.reduce((a,r)=>a+Number(r.invested||0),0); const income=rows.reduce((a,r)=>a+Number(r.distributed||0),0); return <div className="space-y-4"><ModuleHeader icon={WalletCards} title="Owner / Investor Portal" desc="Property-level investment, capital, distributions and return snapshots for owners." action={addButton('Add investment','investor')}/><div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Kpi label="Capital" value={money(invested)}/><Kpi label="Distributed" value={money(income)}/><Kpi label="Records" value={rows.length}/></div><Table rows={rows} onDelete={id=>remove('ownerInvestments',id)} columns={[{key:'ownerName',label:'Owner'},{key:'asset',label:'Asset'},{key:'invested',label:'Capital',render:r=>money(r.invested)},{key:'distributed',label:'Distributed',render:r=>money(r.distributed)},{key:'period',label:'Period'},{key:'notes',label:'Notes'}]} /></div> }

function Analytics({ houses }) { const occupied=houses.filter(h=>h.status==='occupied').length; const vacant=houses.length-occupied; const monthlyRent=houses.filter(h=>h.status==='occupied').reduce((a,h)=>a+Number(h.rentAmount||0),0); const deposits=houses.reduce((a,h)=>a+Number(h.advanceAmount||0),0); const avgRent=occupied?monthlyRent/occupied:0; return <div className="space-y-4"><ModuleHeader icon={BarChart3} title="Advanced Analytics" desc="Live calculations for the active apartment. More metrics are populated as accounting, maintenance and utility records grow."/><div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><Kpi label="Units" value={houses.length}/><Kpi label="Occupied" value={occupied}/><Kpi label="Vacant" value={vacant}/><Kpi label="Occupancy" value={houses.length ? `${Math.round(occupied/houses.length*100)}%` : '0%'}/><Kpi label="Monthly rent" value={money(monthlyRent)}/><Kpi label="Avg. rent" value={money(avgRent)}/></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"><Kpi label="Advance/deposits tracked" value={money(deposits)}/><Kpi label="Occupied rent potential" value={money(monthlyRent*12)}/><Kpi label="Vacancy units" value={vacant}/></div><div className="rm-card p-5"><h4 className="font-bold">Analytics modules</h4><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{['Rent collection trend','Expense by category','Maintenance SLA','Utility consumption','Vacancy duration','Vendor cost','Asset lifecycle','Cash flow','Property comparison'].map(x=><div key={x} className="rounded-xl bg-paper p-3 text-sm font-semibold">{x}</div>)}</div></div></div> }

function AIAssistant({ houses }) { const [q,setQ]=useState(''); const [answer,setAnswer]=useState(''); const [busy,setBusy]=useState(false); async function ask(){ const x=q.toLowerCase(); setBusy(true); try { const [maintenance,inventory,leases,utilities]=await Promise.all([listRecords('maintenanceWorkOrders',localStorage.getItem('rm_active_property')||'default').catch(()=>[]),listRecords('inventoryItems',localStorage.getItem('rm_active_property')||'default').catch(()=>[]),listRecords('leaseRecords',localStorage.getItem('rm_active_property')||'default').catch(()=>[]),listRecords('utilityBills',localStorage.getItem('rm_active_property')||'default').catch(()=>[])]); if(x.includes('vacant')) setAnswer(`${houses.filter(h=>h.status==='vacant').length} units are currently vacant.`); else if(x.includes('occupied')) setAnswer(`${houses.filter(h=>h.status==='occupied').length} units are occupied.`); else if(x.includes('rent')) { const total=houses.filter(h=>h.status==='occupied').reduce((a,h)=>a+Number(h.rentAmount||0),0); setAnswer(`Current occupied monthly rent potential is ${money(total)}.`) } else if(x.includes('maintenance')||x.includes('repair')) setAnswer(`${maintenance.filter(r=>!['completed','cancelled'].includes(r.status)).length} maintenance work orders are currently open.`); else if(x.includes('stock')||x.includes('inventory')) setAnswer(`${inventory.filter(r=>Number(r.quantity||0)<=Number(r.reorderLevel||0)).length} inventory items are at or below reorder level.`); else if(x.includes('lease')) setAnswer(`${leases.filter(r=>r.endDate && r.endDate <= new Date(Date.now()+30*86400000).toISOString().slice(0,10)).length} leases expire within 30 days.`); else if(x.includes('utility')||x.includes('bill')) setAnswer(`${utilities.length} utility bills are recorded for this apartment.`); else setAnswer('Try: vacant units, occupied units, rent, maintenance, inventory/stock, lease expiry, or utility bills. This assistant is local and permission-scoped.'); } finally { setBusy(false) } } return <div className="space-y-4"><ModuleHeader icon={BrainCircuit} title="AI Assistant" desc="A privacy-first operational assistant. It calculates answers locally from the active apartment; external AI can be connected later."/><div className="rm-card p-5"><div className="flex gap-2"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="Ask about this apartment…" className="flex-1 rounded-xl border border-[var(--rm-border)] px-4 py-3"/><button onClick={ask} disabled={busy} className="rounded-xl bg-brand text-white px-4 font-bold disabled:opacity-50">{busy?'…':'Ask'}</button></div>{answer && <div className="mt-4 rounded-2xl bg-brand/5 border border-brand/10 p-4 text-sm"><b>Assistant:</b> {answer}</div>}</div></div> }

function Communication({ rows, addButton, remove }) { return <div className="space-y-4"><ModuleHeader icon={MessageSquare} title="Communication System" desc="Targeted notices, resident messages, read status and communication history." action={addButton('New message','communication')}/><Table rows={rows} onDelete={id=>remove('communicationMessages',id)} columns={[{key:'createdAt',label:'Created',render:r=>new Date(r.createdAt).toLocaleString('en-IN')},{key:'audience',label:'Audience'},{key:'title',label:'Title'},{key:'channel',label:'Channel'},{key:'status',label:'Status'}]} /></div> }

function Audit({ rows }) { return <div className="space-y-4"><ModuleHeader icon={LockKeyhole} title="Audit & Security" desc="Existing activity logs plus security events, permission changes and sensitive-operation traceability."/><Table rows={rows} columns={[{key:'timestamp',label:'Time',render:r=>new Date(r.timestamp||r.createdAt).toLocaleString('en-IN')},{key:'action',label:'Action'},{key:'entityType',label:'Entity'},{key:'performedByName',label:'By'},{key:'details',label:'Details'}]} /></div> }

function Backup({ rows, properties, save }) { const [status,setStatus]=useState(''); async function backup(){ setStatus('Preparing…'); try { const activePropertyId=localStorage.getItem('rm_active_property')||'default'; const data=await exportCollections(['accountingTransactions','maintenanceWorkOrders','preventiveMaintenance','purchaseOrders','inventoryItems','securityEvents','parcels','documentRegistry','leaseRecords','utilityBills','ownerInvestments','communicationMessages','societyHierarchy','apiIntegrations'], activePropertyId); const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),properties,data},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`rental-manager-disaster-backup-${today()}.json`; a.click(); URL.revokeObjectURL(url); setStatus('Backup package downloaded.'); await save('backupPlans',{name:`Manual backup ${today()}`,status:'completed',scope:'enterprise-modules'}); } catch(e){ setStatus(e.message||'Backup failed') } } return <div className="space-y-4"><ModuleHeader icon={DatabaseBackup} title="Backup & Disaster Recovery" desc="Portable export packages plus recovery-plan records. Production scheduled backups can later run server-side." action={<button onClick={backup} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"><HardDrive size={16}/>Create backup</button>}/><div className="grid sm:grid-cols-3 gap-3"><Kpi label="Backup records" value={rows.length}/><Kpi label="Properties" value={properties.length}/><Kpi label="Recovery mode" value="Property-scoped export"/></div>{status&&<div className="rm-card p-4 text-sm">{status}</div>}</div> }

function Integrations({ rows, addButton, remove }) { return <div className="space-y-4"><ModuleHeader icon={BriefcaseBusiness} title="API & Integrations" desc="Connection registry for payment, WhatsApp, accounting, calendar, IoT and future AI providers. Secrets must stay server-side." action={addButton('Add integration','integrations')}/><div className="rm-card p-4 bg-amber-50/50 text-xs text-ink-soft">Never put API keys, webhook secrets or OAuth client secrets in Firestore/browser records. Store only provider name, status and a server-side secret reference.</div><Table rows={rows} onDelete={id=>remove('apiIntegrations',id)} columns={[{key:'provider',label:'Provider'},{key:'category',label:'Category'},{key:'status',label:'Status'},{key:'endpoint',label:'Endpoint'},{key:'secretRef',label:'Secret reference'}]} /></div> }

function Kpi({label,value}) { return <div className="rm-card p-4"><div className="text-xs text-ink-soft">{label}</div><div className="font-display text-xl font-extrabold mt-1">{value}</div></div> }

function CreateModal({ type, houses, properties, onClose, onSave }) {
  const [form,setForm]=useState({date:today(),receivedAt:new Date().toISOString(),dueDate:today(),expiryDate:'',startDate:today(),endDate:'',status:'open',priority:'medium',kind:'expense',amount:'',quantity:'1',reorderLevel:'1',unitCost:'0',distributed:'0',invested:'0',channel:'in-app'})
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const h = <Field label="House / Unit" value={form.houseId||''} onChange={v=>set('houseId',v)} options={[['','Property / Gate'],...houses.map(x=>[x.id,x.internalDoorNumber])]} />
  let title='Create record', fields=null, collection=''
  if(type==='accounting'){ title='New double-entry journal'; collection='accountingTransactions'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Date" type="date" value={form.date} onChange={v=>set('date',v)}/><Field label="Category" value={form.category||''} onChange={v=>set('category',v)} placeholder="Rent / Repair / Vendor"/><Field label="Debit account" value={form.debitAccount||'Cash / Bank'} onChange={v=>set('debitAccount',v)} options={[['Cash / Bank','Cash / Bank'],['Rent Receivable','Rent Receivable'],['Maintenance Expense','Maintenance Expense'],['Utility Expense','Utility Expense'],['Vendor Payable','Vendor Payable'],['Asset','Asset']]}/><Field label="Credit account" value={form.creditAccount||'Rental Income'} onChange={v=>set('creditAccount',v)} options={[['Rental Income','Rental Income'],['Cash / Bank','Cash / Bank'],['Vendor Payable','Vendor Payable'],['Security Deposit','Security Deposit'],['Owner Capital','Owner Capital'],['Utility Payable','Utility Payable']]}/><Field label="Amount" type="number" value={form.amount} onChange={v=>set('amount',v)}/>{h}<Field label="Description" value={form.description||''} onChange={v=>set('description',v)}/></div>}
  if(type==='maintenance'){ title='New maintenance work order'; collection='maintenanceWorkOrders'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Title" value={form.title||''} onChange={v=>set('title',v)}/>{h}<Field label="Priority" value={form.priority} onChange={v=>set('priority',v)} options={[['low','Low'],['medium','Medium'],['high','High'],['emergency','Emergency']]}/><Field label="Status" value={form.status} onChange={v=>set('status',v)} options={[['open','Open'],['assigned','Assigned'],['in-progress','In progress'],['completed','Completed']]}/><Field label="Due date" type="date" value={form.dueDate} onChange={v=>set('dueDate',v)}/><Field label="Vendor / Technician" value={form.vendor||''} onChange={v=>set('vendor',v)}/><Field label="Actual cost" type="number" value={form.cost||0} onChange={v=>set('cost',v)}/><Field label="Preventive schedule?" value={form.preventive?'yes':'no'} onChange={v=>set('preventive',v==='yes')} options={[['no','No'],['yes','Yes']]}/><Field label="Notes" value={form.notes||''} onChange={v=>set('notes',v)}/></div>}
  if(type==='preventive'){ title='Preventive maintenance schedule'; collection='preventiveMaintenance'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Asset / system" value={form.asset||''} onChange={v=>set('asset',v)} placeholder="Sump pump / CCTV / tank"/>{h}<Field label="Frequency (days)" type="number" value={form.frequencyDays||30} onChange={v=>set('frequencyDays',v)}/><Field label="Next run" type="date" value={form.nextRun||today()} onChange={v=>set('nextRun',v)}/><Field label="Vendor" value={form.vendor||''} onChange={v=>set('vendor',v)}/><Field label="Auto-create work order" value={form.autoCreate?'yes':'no'} onChange={v=>set('autoCreate',v==='yes')} options={[['no','No'],['yes','Yes']]}/></div>}
  if(type==='purchases'){ title='New purchase order'; collection='purchaseOrders'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="PO number" value={form.poNumber||`PO-${Date.now()}`} onChange={v=>set('poNumber',v)}/><Field label="Supplier" value={form.supplier||''} onChange={v=>set('supplier',v)}/><Field label="Order date" type="date" value={form.orderDate||today()} onChange={v=>set('orderDate',v)}/><Field label="Total" type="number" value={form.total||0} onChange={v=>set('total',v)}/><Field label="Status" value={form.status||'draft'} onChange={v=>set('status',v)} options={[['draft','Draft'],['approved','Approved'],['ordered','Ordered'],['received','Received'],['cancelled','Cancelled']]}/><Field label="Invoice reference" value={form.invoiceRef||''} onChange={v=>set('invoiceRef',v)}/><Field label="Inventory item ID (optional)" value={form.inventoryItemId||''} onChange={v=>set('inventoryItemId',v)} placeholder="Select/copy an inventory item ID"/><Field label="Received quantity" type="number" value={form.receivedQuantity||0} onChange={v=>set('receivedQuantity',v)}/></div>}
  if(type==='inventory'){ title='Add inventory item'; collection='inventoryItems'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Item" value={form.name||''} onChange={v=>set('name',v)}/><Field label="SKU" value={form.sku||''} onChange={v=>set('sku',v)}/><Field label="Quantity" type="number" value={form.quantity} onChange={v=>set('quantity',v)}/><Field label="Reorder level" type="number" value={form.reorderLevel} onChange={v=>set('reorderLevel',v)}/><Field label="Supplier" value={form.supplier||''} onChange={v=>set('supplier',v)}/><Field label="Unit cost" type="number" value={form.unitCost} onChange={v=>set('unitCost',v)}/></div>}
  if(type==='security'){ title='Record gate/security event'; collection='securityEvents'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Date" type="date" value={form.date} onChange={v=>set('date',v)}/><Field label="Event" value={form.eventType||'visitor'} onChange={v=>set('eventType',v)} options={[['visitor','Visitor'],['delivery','Delivery'],['staff','Staff'],['vehicle','Vehicle'],['incident','Incident']]}/><Field label="Person" value={form.personName||''} onChange={v=>set('personName',v)}/>{h}<Field label="Vehicle no." value={form.vehicleNo||''} onChange={v=>set('vehicleNo',v)}/><Field label="Status" value={form.status} onChange={v=>set('status',v)} options={[['approved','Approved'],['inside','Inside'],['exited','Exited'],['incident-open','Incident open']]}/></div>}
  if(type==='parcel'){ title='Record parcel'; collection='parcels'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Received" type="datetime-local" value={form.receivedAt.slice(0,16)} onChange={v=>set('receivedAt',v)}/><Field label="Courier" value={form.courier||''} onChange={v=>set('courier',v)}/><Field label="Tracking number" value={form.trackingNo||''} onChange={v=>set('trackingNo',v)}/>{h}<Field label="Status" value={form.status} onChange={v=>set('status',v)} options={[['received','Received'],['notified','Resident notified'],['picked-up','Picked up']]}/></div>}
  if(type==='documents'){ title='Register document'; collection='documentRegistry'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Document name" value={form.name||''} onChange={v=>set('name',v)}/><Field label="Category" value={form.category||'Property'} onChange={v=>set('category',v)}/>{h}<Field label="Expiry" type="date" value={form.expiryDate} onChange={v=>set('expiryDate',v)}/><Field label="Secure file reference" value={form.fileRef||''} onChange={v=>set('fileRef',v)} placeholder="Cloudinary/document ID"/></div>}
  if(type==='leases'){ title='New lease'; collection='leaseRecords'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Tenant name" value={form.tenantName||''} onChange={v=>set('tenantName',v)}/>{h}<Field label="Start" type="date" value={form.startDate} onChange={v=>set('startDate',v)}/><Field label="End" type="date" value={form.endDate} onChange={v=>set('endDate',v)}/><Field label="Rent" type="number" value={form.rent||''} onChange={v=>set('rent',v)}/><Field label="Deposit" type="number" value={form.deposit||''} onChange={v=>set('deposit',v)}/><Field label="Escalation %" type="number" value={form.escalation||''} onChange={v=>set('escalation',v)}/><Field label="Notice days" type="number" value={form.noticeDays||30} onChange={v=>set('noticeDays',v)}/></div>}
  if(type==='utilities'){ title='New utility bill'; collection='utilityBills'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Utility" value={form.utilityType||'electricity'} onChange={v=>set('utilityType',v)} options={[['electricity','Electricity'],['water','Water'],['gas','Gas'],['generator','Generator'],['solar','Solar'],['other','Other']]}/>{h}<Field label="Previous reading" type="number" value={form.previousReading||0} onChange={v=>set('previousReading',v)}/><Field label="Current reading" type="number" value={form.currentReading||0} onChange={v=>set('currentReading',v)}/><Field label="Rate / unit" type="number" value={form.ratePerUnit||0} onChange={v=>set('ratePerUnit',v)}/><Field label="Fixed charge" type="number" value={form.fixedCharge||0} onChange={v=>set('fixedCharge',v)}/><Field label="Amount" type="number" value={form.amount || (Math.max(0,Number(form.currentReading||0)-Number(form.previousReading||0))*Number(form.ratePerUnit||0)+Number(form.fixedCharge||0))} onChange={v=>set('amount',v)}/><Field label="Due date" type="date" value={form.dueDate} onChange={v=>set('dueDate',v)}/></div>}
  if(type==='investor'){ title='Add investment record'; collection='ownerInvestments'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Owner" value={form.ownerName||''} onChange={v=>set('ownerName',v)}/><Field label="Asset / property" value={form.asset||''} onChange={v=>set('asset',v)}/><Field label="Capital invested" type="number" value={form.invested} onChange={v=>set('invested',v)}/><Field label="Distributed" type="number" value={form.distributed} onChange={v=>set('distributed',v)}/><Field label="Period" value={form.period||''} onChange={v=>set('period',v)} placeholder="FY 2026-27"/><Field label="Notes" value={form.notes||''} onChange={v=>set('notes',v)}/></div>}
  if(type==='communication'){ title='New communication'; collection='communicationMessages'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Audience" value={form.audience||'all-residents'} onChange={v=>set('audience',v)} options={[['all-residents','All residents'],['selected-house','Selected house'],['owners','Owners'],['security','Security']]}/><Field label="Channel" value={form.channel} onChange={v=>set('channel',v)} options={[['in-app','In-app'],['email','Email'],['whatsapp','WhatsApp'],['sms','SMS']]}/><Field label="Title" value={form.title||''} onChange={v=>set('title',v)}/><Field label="Message" value={form.message||''} onChange={v=>set('message',v)}/></div>}
  if(type==='backup') { title='Backup plan'; collection='backupPlans'; fields=<Field label="Plan name" value={form.name||''} onChange={v=>set('name',v)}/> }
  if(type==='integrations'){ title='Add API integration'; collection='apiIntegrations'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Provider" value={form.provider||''} onChange={v=>set('provider',v)} placeholder="Razorpay / WhatsApp / Google Calendar"/><Field label="Category" value={form.category||'payments'} onChange={v=>set('category',v)}/><Field label="Status" value={form.status||'planned'} onChange={v=>set('status',v)} options={[['planned','Planned'],['connected','Connected'],['disabled','Disabled']]}/><Field label="Endpoint" value={form.endpoint||''} onChange={v=>set('endpoint',v)}/><Field label="Server secret reference" value={form.secretRef||''} onChange={v=>set('secretRef',v)} /></div>}
  if(type==='hierarchy'){ title='Add hierarchy level'; collection='societyHierarchy'; fields=<div className="grid sm:grid-cols-2 gap-3"><Field label="Level" value={form.levelType||'building'} onChange={v=>set('levelType',v)} options={[['society','Society'],['building','Building'],['floor','Floor'],['unit','Unit']]}/><Field label="Name" value={form.name||''} onChange={v=>set('name',v)}/><Field label="Parent" value={form.parentName||''} onChange={v=>set('parentName',v)}/><Field label="Notes" value={form.notes||''} onChange={v=>set('notes',v)}/></div>}
  return <Modal title={title} onClose={onClose}><div className="space-y-4">{fields}<div className="flex justify-end gap-2 pt-2"><button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[var(--rm-border)] font-semibold">Cancel</button><button onClick={() => { const data={...form}; if(data.previousReading!==undefined&&data.currentReading!==undefined) { data.consumption=Math.max(0,Number(data.currentReading)-Number(data.previousReading)); if(data.ratePerUnit!==undefined) data.amount=data.consumption*Number(data.ratePerUnit||0)+Number(data.fixedCharge||0) } onSave(collection,data) }} className="px-4 py-2.5 rounded-xl bg-brand text-white font-bold">Save</button></div></div></Modal>
}
