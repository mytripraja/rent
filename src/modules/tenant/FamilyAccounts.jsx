import { useEffect, useState } from 'react'
import { Users, Plus, ShieldCheck, Check, X, UserRound, Trash2, Power, Eye, EyeOff } from 'lucide-react'
import TextField from '../shared/ui/TextField'
import { createSubTenantAccount, deleteSubTenantAccount, isPrimaryTenant, listHouseTenantAccounts, updateSubTenantAccount, DEFAULT_TENANT_PERMISSIONS } from '../../services/tenantAccountService'
import { useAuth } from '../../context/AuthContext'

const PERMISSIONS = [
  ['rent', 'Rent & payment status'], ['bills', 'EB & water bills'], ['notices', 'Notices'], ['complaints', 'Complaints'],
  ['maintenance', 'Maintenance'], ['visitors', 'Visitors'], ['commonArea', 'Common-area booking'], ['documents', 'Documents'],
  ['directory', 'Neighbour directory'], ['community', 'Community board'],
]

export default function FamilyAccounts({ houseId: propHouseId, ownerMode = false } = {}) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', relationship: '', email: '', phone: '', password: '', permissions: { ...DEFAULT_TENANT_PERMISSIONS } })

  const primary = isPrimaryTenant(user)
  const effectiveHouseId = propHouseId || user?.houseId

  async function load() {
    setLoading(true)
    try { setAccounts(await listHouseTenantAccounts(effectiveHouseId)) } catch { setMessage('Could not load family accounts.') } finally { setLoading(false) }
  }
  useEffect(() => { if (effectiveHouseId && (ownerMode || primary)) load() }, [effectiveHouseId, ownerMode, primary])
  if (!ownerMode && !primary) return null

  function reset() {
    setForm({ name: '', relationship: '', email: '', phone: '', password: '', permissions: { ...DEFAULT_TENANT_PERMISSIONS } })
    setShowCreate(false); setEditing(null); setMessage('')
  }

  async function create(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      await createSubTenantAccount({ houseId: effectiveHouseId, ...form })
      await load(); reset(); setMessage('Family account created successfully.')
    } catch (err) { setMessage(err.message || 'Could not create account.') } finally { setBusy(false) }
  }

  function beginEdit(account) {
    setEditing(account)
    setForm({ name: account.name || '', relationship: account.relationship || '', email: account.email || '', phone: account.phone || '', password: '', permissions: { ...DEFAULT_TENANT_PERMISSIONS, ...(account.tenantPermissions || {}) } })
    setShowCreate(false)
  }

  async function saveEdit(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try { await updateSubTenantAccount(editing.uid, { name: form.name, phone: form.phone, relationship: form.relationship, permissions: form.permissions }); await load(); reset(); setMessage('Family account updated.') }
    catch (err) { setMessage(err.message || 'Could not update account.') } finally { setBusy(false) }
  }

  async function toggleDisabled(account) {
    setBusy(true)
    try { await updateSubTenantAccount(account.uid, { disabled: !account.disabled }); await load() }
    catch (err) { setMessage(err.message || 'Could not change account status.') } finally { setBusy(false) }
  }

  async function remove(account) {
    if (!window.confirm(`Remove ${account.name}'s family account? Their rent and house history will remain.`)) return
    setBusy(true)
    try { await deleteSubTenantAccount(account.uid); await load(); setMessage('Family account removed.') }
    catch (err) { setMessage(err.message || 'Could not remove account.') } finally { setBusy(false) }
  }

  const subs = accounts.filter(a => a.accountType === 'sub')
  return (
    <section className="rounded-3xl border border-[var(--rm-border)] bg-paper-raised shadow-sm p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3"><div className="w-11 h-11 rounded-2xl bg-brand/10 text-brand flex items-center justify-center"><Users size={20}/></div><div><p className="text-[10px] uppercase tracking-[.16em] text-ink-soft font-bold">Household access</p><h2 className="font-display text-xl font-bold text-ink">Family accounts</h2><p className="text-sm text-ink-soft mt-1">Create up to 5 separate logins and decide what each person can use.</p></div></div>
        {subs.length < 5 && <button onClick={() => { reset(); setShowCreate(true) }} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-sm font-semibold"><Plus size={16}/> Add</button>}
      </div>

      <div className="mt-4 rounded-2xl bg-brand/5 border border-brand/10 p-3 flex gap-2 text-xs text-ink-soft"><ShieldCheck size={16} className="text-brand shrink-0"/><span>The main account stays in control. Family accounts can have the same app experience, but each permission can be switched off.</span></div>
      {message && <div className="mt-3 text-sm text-brand bg-brand/5 rounded-xl p-3">{message}</div>}

      <div className="mt-4 space-y-2">
        {loading ? <p className="text-sm text-ink-soft py-5">Loading accounts…</p> : subs.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--rm-border)] p-5 text-center"><UserRound className="mx-auto text-ink-soft"/><p className="text-sm font-semibold text-ink mt-2">No family accounts yet</p><p className="text-xs text-ink-soft mt-1">Add a spouse, child or other household member.</p></div> : subs.map(a => <div key={a.uid} className="rounded-2xl border border-[var(--rm-border)] bg-paper p-3 sm:p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">{(a.name||'?')[0]}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="font-semibold text-ink truncate">{a.name}</p>{a.disabled && <span className="text-[10px] rounded-full bg-red-100 text-red-700 px-2 py-0.5">Disabled</span>}</div><p className="text-xs text-ink-soft truncate">{a.relationship || 'Family member'} · {a.email}</p></div><button onClick={() => beginEdit(a)} className="text-xs font-semibold text-brand px-2.5 py-2 rounded-lg bg-brand/5">Manage</button><button onClick={() => toggleDisabled(a)} disabled={busy} className="w-9 h-9 rounded-lg border border-[var(--rm-border)] flex items-center justify-center text-ink-soft" title={a.disabled?'Enable':'Disable'}>{a.disabled?<Power size={16}/>:<EyeOff size={16}/>}</button><button onClick={() => remove(a)} disabled={busy} className="w-9 h-9 rounded-lg border border-red-200 text-red-600 flex items-center justify-center" title="Remove"><Trash2 size={16}/></button></div>)}
      </div>

      {(showCreate || editing) && <div className="mt-5 pt-5 border-t border-[var(--rm-border)]"><div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-ink">{editing ? `Manage ${editing.name}` : 'Create family account'}</h3><p className="text-xs text-ink-soft mt-0.5">{editing ? 'Change profile and access permissions.' : `${5 - subs.length} slot${5-subs.length===1?'':'s'} remaining`}</p></div><button onClick={reset} className="w-9 h-9 rounded-lg bg-paper flex items-center justify-center"><X size={18}/></button></div>
        <form onSubmit={editing ? saveEdit : create} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3"><TextField label="Name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><TextField label="Relationship" placeholder="Wife, son, daughter…" value={form.relationship} onChange={e=>setForm({...form,relationship:e.target.value})}/><TextField label="Email" type="email" required={!editing} disabled={!!editing} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><TextField label="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>{!editing && <TextField label="Temporary password" type="password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} hint="They can change it later using password reset."/>}</div>
          <div><div className="flex items-center justify-between mb-2"><h4 className="text-sm font-semibold text-ink">What can this account access?</h4><button type="button" onClick={()=>setForm({...form,permissions:Object.fromEntries(PERMISSIONS.map(([k])=>[k,true]))})} className="text-xs text-brand font-semibold">Allow all</button></div><div className="grid sm:grid-cols-2 gap-2">{PERMISSIONS.map(([key,label])=>{const on=form.permissions[key]!==false;return <button type="button" key={key} onClick={()=>setForm({...form,permissions:{...form.permissions,[key]:!on}})} className={`flex items-center gap-2 p-3 rounded-xl border text-left ${on?'border-brand/20 bg-brand/5':'border-[var(--rm-border)] bg-paper'}`}><span className={`w-7 h-7 rounded-lg flex items-center justify-center ${on?'bg-brand text-white':'bg-paper-raised text-ink-soft'}`}>{on?<Check size={15}/>:<X size={15}/>}</span><span className="text-xs font-medium text-ink">{label}</span></button>})}</div></div>
          <div className="flex gap-2"><button disabled={busy} className="flex-1 rounded-xl bg-brand text-white py-2.5 text-sm font-semibold">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</button><button type="button" onClick={reset} className="px-4 rounded-xl border border-[var(--rm-border)] text-sm">Cancel</button></div>
        </form>
      </div>}
    </section>
  )
}
