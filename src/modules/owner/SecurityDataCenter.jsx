import { ShieldCheck, ScrollText, DatabaseBackup, Settings, UserRound, LockKeyhole, ChevronRight } from 'lucide-react'
import ActivityLog from './ActivityLog'
import DataBackup from './DataBackup'
import AppSettings from './AppSettings'
import OwnerProfile from './OwnerProfile'
import { useState } from 'react'

const ITEMS = [
  ['activity', 'Activity & audit log', 'See important changes made in the property workspace.', ScrollText],
  ['backup', 'Data backup', 'Export a copy of your operational data.', DatabaseBackup],
  ['settings', 'Privacy & app settings', 'Manage appearance, language and product preferences.', Settings],
  ['profile', 'Account profile', 'Review your owner/admin profile and account details.', UserRound],
]

export default function SecurityDataCenter() {
  const [view, setView] = useState(null)
  const active = ITEMS.find(x => x[0] === view)
  if (active) {
    const Comp = { activity: ActivityLog, backup: DataBackup, settings: AppSettings, profile: OwnerProfile }[view]
    return <div className="space-y-5"><button onClick={() => setView(null)} className="text-sm font-semibold text-brand">← Back to Security & data</button><Comp /></div>
  }
  return <div className="space-y-6">
    <div><div className="rm-kicker">Administration</div><h2 className="font-display text-3xl font-extrabold mt-1 flex items-center gap-2"><ShieldCheck className="text-brand"/> Security & data</h2><p className="text-sm text-ink-soft mt-1">Keep account, audit and backup controls together.</p></div>
    <div className="rounded-3xl border border-brand/10 bg-brand/5 p-5 flex gap-3"><LockKeyhole className="text-brand shrink-0" size={20}/><div><p className="font-semibold text-ink text-sm">Your property data stays role-controlled.</p><p className="text-xs text-ink-soft mt-1">Owner/admin tools are separated from tenant and family-account permissions.</p></div></div>
    <div className="grid sm:grid-cols-2 gap-3">{ITEMS.map(([id,label,desc,Icon]) => <button key={id} onClick={() => setView(id)} className="rm-card rm-card-hover p-4 text-left flex gap-3 items-center"><span className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center"><Icon size={20}/></span><span className="flex-1"><strong className="block text-sm text-ink">{label}</strong><span className="block text-xs text-ink-soft mt-1 leading-5">{desc}</span></span><ChevronRight size={17} className="text-ink-soft"/></button>)}</div>
  </div>
}
