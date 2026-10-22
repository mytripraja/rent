import React, { useEffect, useRef, useState, Suspense } from 'react'
import { CalendarDays, FileText, Home, IndianRupee, LogOut, Map, ReceiptText, Settings, UsersRound, MessagesSquare, Building2, LayoutDashboard, Megaphone, Wrench, WalletCards, Search, ArrowRight } from 'lucide-react'

const RentSubmission = React.lazy(() => import('./RentSubmission'))
const RentHistory = React.lazy(() => import('./RentHistory'))
const EBBillShare = React.lazy(() => import('./EBBillShare'))
const WaterBillShare = React.lazy(() => import('./WaterBillShare'))
const NoticeFeed = React.lazy(() => import('./NoticeFeed'))
const RaiseComplaint = React.lazy(() => import('./RaiseComplaint'))
const RentAgreementView = React.lazy(() => import('./RentAgreementView'))
const Directory = React.lazy(() => import('./Directory'))
const ServiceContacts = React.lazy(() => import('./ServiceContacts'))
const RentRevisionBanner = React.lazy(() => import('./RentRevisionBanner'))
const DocumentUpload = React.lazy(() => import('./DocumentUpload'))
const TenantRentHero = React.lazy(() => import('./TenantRentHero'))
const CommunityBoard = React.lazy(() => import('../shared/CommunityBoard'))
const MaintenanceRequest = React.lazy(() => import('./MaintenanceRequest'))
const VisitorLog = React.lazy(() => import('./VisitorLog'))
const BookCommonArea = React.lazy(() => import('./BookCommonArea'))
const FamilyAccounts = React.lazy(() => import('./FamilyAccounts'))
const IndiaCalendar = React.lazy(() => import('../shared/IndiaCalendar'))
const WifiShareBoard = React.lazy(() => import('../shared/WifiShareBoard'))
const WasteSchedule = React.lazy(() => import('../shared/WasteSchedule'))
const BlueprintManager = React.lazy(() => import('../owner/BlueprintManager'))
import LoadingScreen from '../shared/LoadingScreen'
import PullToRefresh from '../shared/ui/PullToRefresh'
import IconButton from '../shared/ui/IconButton'
import ThemeToggle from '../shared/ui/ThemeToggle'
import InstallAppPrompt from '../shared/ui/InstallAppPrompt'
import UserSettingsModal from '../shared/UserSettingsModal'
import NotificationBell from '../shared/ui/NotificationBell'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { tenantCan } from '../../services/tenantAccountService'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => { const q = window.matchMedia('(max-width: 767px)'); const fn = () => setMobile(q.matches); q.addEventListener?.('change', fn); return () => q.removeEventListener?.('change', fn) }, [])
  return mobile
}

export default function TenantDashboard() {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isMobile = useIsMobile()

  // Preload the screens a resident is most likely to open next, once the app
  // is idle, so tab switches do not wait on a network round-trip.
  useEffect(() => {
    const warm = () => {
      import('./TenantRentHero')
      import('./RentSubmission')
      import('./RentHistory')
      import('./NoticeFeed')
      import('./EBBillShare')
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const timer = setTimeout(warm, 1500)
    return () => clearTimeout(timer)
  }, [])

  async function handleRefresh() { setRefreshKey(k => k + 1); await new Promise(r => setTimeout(r, 500)) }

  return <div className="min-h-screen bg-paper rm-tenant-app">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    {isMobile ? <>
      <header className="rm-tenant-mobile-topbar">
        <div className="rm-tenant-mobile-brand"><span className="rm-profile-avatar">{user?.name?.[0]}</span><span><strong>{user?.propertyName || 'Rental Manager'}</strong><small>{user?.name} · {user?.houseId}</small></span></div>
        <div className="flex items-center gap-1"><NotificationBell userId={user?.uid}/><button type="button" onClick={() => setSettingsOpen(true)} className="rm-icon-button" aria-label="Open settings"><Settings size={17}/></button></div>
      </header>
      <PullToRefresh onRefresh={handleRefresh}><Suspense fallback={<LoadingScreen />}><MobileTenantContent user={user} refreshKey={refreshKey} setRefreshKey={setRefreshKey} /></Suspense></PullToRefresh>
    </> : <TenantDesktopShell user={user} onSettings={() => setSettingsOpen(true)} onLogout={logout}>
      <PullToRefresh onRefresh={handleRefresh}><Suspense fallback={<LoadingScreen />}><DesktopTenantContent user={user} refreshKey={refreshKey} setRefreshKey={setRefreshKey} /></Suspense></PullToRefresh>
    </TenantDesktopShell>}

    <InstallAppPrompt />
    <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </div>
}

function DesktopTenantContent({ user, refreshKey, setRefreshKey }) {
  const payRef = useRef(null)
  return <main id="main-content" tabIndex={-1} className="rm-tenant-workspace">
    <div id="tenant-home" className="rm-tenant-heading"><div><h1>Welcome home, {user?.name?.split(' ')[0] || 'there'}</h1><p>{user?.houseId ? `${user.houseId} · ` : ''}{user?.propertyName || 'Your rental home'} · Your home workspace</p></div></div>
    <div className="rm-tenant-home-grid">
      <div className="rm-tenant-home-main">
        {tenantCan(user, 'rentStatus') && <TenantRentHero key={`hero-${refreshKey}`} canSubmit={tenantCan(user, 'rentSubmit')} showDetails={tenantCan(user, 'rentDetails')} onPayNow={() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />}
        {tenantCan(user, 'rentDetails') && <RentRevisionBanner />}
        {tenantCan(user, 'notices') && <section id="tenant-messages" className="rm-tenant-panel"><div className="rm-tenant-panel-heading"><h2>Around your home</h2><a href="#tenant-messages">View notices <ArrowRight size={13}/></a></div><NoticeFeed />{tenantCan(user, 'maintenance') && <div className="rm-tenant-embedded"><MaintenanceRequest /></div>}{tenantCan(user, 'rentDetails') && <div className="rm-tenant-embedded"><RentAgreementView /></div>}</section>}
        {tenantCan(user, 'rentDetails') && <section id="tenant-rent" className="rm-tenant-panel"><div className="rm-tenant-panel-heading"><h2>Rent history</h2><a href="#tenant-rent">All payments <ArrowRight size={13}/></a></div><RentHistory key={`history-${refreshKey}`} /></section>}
        <div id="tenant-more" className="rm-tenant-services">
          {tenantCan(user, 'complaints') && <RaiseComplaint />}{tenantCan(user, 'directory') && <Directory />}{tenantCan(user, 'serviceContacts') && <ServiceContacts />}{tenantCan(user, 'documents') && <DocumentUpload />}{tenantCan(user, 'blueprint') && <div id="tenant-blueprint"><BlueprintManager /></div>}{tenantCan(user, 'visitors') && <VisitorLog />}{tenantCan(user, 'commonArea') && <BookCommonArea />}{isSubAccount(user) && <FamilyAccessNotice />}
        </div>
        {tenantCan(user, 'calendar') && <section id="tenant-calendar" className="rm-tenant-panel"><div className="rm-tenant-panel-heading"><h2>Home calendar</h2></div><IndiaCalendar compact/><WasteSchedule/></section>}
        {tenantCan(user, 'community') && <CommunityBoard user={user} />}{tenantCan(user, 'community') && <WifiShareBoard />}{isPrimary(user) && tenantCan(user, 'family') && <FamilyAccounts />}
        <footer className="rm-tenant-footer">Need help? Open Service contacts or send a maintenance request to your property owner.</footer>
      </div>
      <aside className="rm-tenant-home-aside">
        {tenantCan(user, 'bills') && <section id="tenant-bills" className="rm-tenant-panel rm-tenant-bill-panel"><div className="rm-tenant-panel-heading"><h2>Water bill</h2></div><WaterBillShare key={`water-${refreshKey}`} /></section>}
        {tenantCan(user, 'bills') && <section className="rm-tenant-panel rm-tenant-bill-panel"><div className="rm-tenant-panel-heading"><h2>Electricity / EB</h2></div><EBBillShare key={`eb-${refreshKey}`} /></section>}
        {tenantCan(user, 'rentSubmit') && <section ref={payRef} className="rm-tenant-panel rm-tenant-payment-panel"><div className="rm-tenant-panel-heading"><h2>Already made a payment?</h2></div><p>Submit proof for another bill or payment. Your rent is reviewed by the property owner.</p><RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} /></section>}
      </aside>
    </div>
  </main>
}

function TenantDesktopShell({ user, onSettings, onLogout, children }) {
  const nav = [['Home','tenant-home',LayoutDashboard],['Payments','tenant-rent',WalletCards],['Bills','tenant-bills',ReceiptText],['Notices','tenant-messages',Megaphone],['Maintenance','tenant-more',Wrench],['Agreement','tenant-more',FileText],['Settings','tenant-more',Settings]]
  function jump(id) { document.getElementById(id)?.scrollIntoView({ behavior:'smooth',block:'start' }) }
  return <div className="rm-tenant-layout">
    <aside className="rm-tenant-sidebar"><div className="rm-owner-brand"><Building2 size={19}/><span>Rental Manager</span></div><div className="rm-tenant-identity"><span>TENANT WORKSPACE</span><strong>{user?.propertyName || 'Your rental home'}</strong><small>{user?.houseId || 'Resident account'} · {user?.name}</small></div><nav>{nav.map(([label,id,Icon],index)=><button key={label} onClick={()=>jump(id)} className={index===0?'is-active':''}><Icon size={15}/>{label}</button>)}</nav><div className="rm-owner-profile"><span className="rm-profile-avatar">{user?.name?.[0]}</span><span><strong>{user?.name}</strong><small>Tenant · {user?.houseId}</small></span></div></aside>
    <div className="rm-owner-main-column"><header className="rm-owner-topbar"><span className="rm-topbar-property">{user?.propertyName || 'Your home'}</span><div className="rm-topbar-actions"><label className="rm-tenant-global-search"><Search size={14}/><input aria-label="Search your workspace" placeholder="Search your workspace"/></label><NotificationBell userId={user?.uid}/><ThemeToggle/><button type="button" onClick={onSettings} className="rm-icon-button" aria-label="Open settings"><Settings size={17}/></button><IconButton icon={LogOut} label="Log out" onClick={onLogout}/></div></header>{children}</div>
  </div>
}

function MobileTenantContent({ user, refreshKey, setRefreshKey }) {
  const [section, setSection] = useState('home')
  const [tool, setTool] = useState('calendar')
  const [moreOpen, setMoreOpen] = useState(false)
  const go = (next, nextTool) => { setSection(next); if (nextTool) setTool(nextTool); setMoreOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <>
    <main id="main-content" tabIndex={-1} className="px-3 pt-3 pb-24 max-w-xl mx-auto space-y-3">
      {section === 'home' && <>
        {tenantCan(user, 'rentStatus') && <TenantRentHero key={`mhero-${refreshKey}`} canSubmit={tenantCan(user, 'rentSubmit')} showDetails={tenantCan(user, 'rentDetails')} onPayNow={() => go('rent')} />}
        {tenantCan(user, 'rentDetails') && <RentRevisionBanner />}
        {tenantCan(user, 'notices') && <NoticeFeed />}
        <div className="grid grid-cols-3 gap-2" aria-label="Quick tools">
          {tenantCan(user, 'calendar') && <QuickTile icon={CalendarDays} label="Calendar" onClick={() => go('tools','calendar')} />}
          {tenantCan(user, 'blueprint') && <QuickTile icon={Map} label="Blueprint" onClick={() => go('tools','blueprint')} />}
          
          {tenantCan(user, 'community') && <QuickTile icon={MessagesSquare} label="Community" onClick={() => go('tools','community')} />}
        </div>
        <div className="rm-card p-4 border-brand/10"><div className="flex items-center gap-2"><UsersRound size={18} className="text-brand"/><div><h2 className="font-bold text-ink">Your home dashboard</h2><p className="text-xs text-ink-soft mt-0.5">Use the bottom navigation instead of scrolling through one long page.</p></div></div></div>
      </>}

      {section === 'rent' && (tenantCan(user, 'rentStatus') || tenantCan(user, 'rentDetails') || tenantCan(user, 'rentSubmit')) && <section className="space-y-3"><SectionTitle title="Rent & payment" icon={IndianRupee} /><p className="text-xs text-ink-soft px-1">Your access is controlled by the property administrator.</p>{tenantCan(user, 'rentSubmit') && <RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} />}{tenantCan(user, 'rentDetails') && <RentHistory key={`mrent-${refreshKey}`} />}{tenantCan(user, 'rentDetails') && <RentAgreementView />}</section>}
      {section === 'bills' && tenantCan(user, 'bills') && <section className="space-y-3"><SectionTitle title="Bills" icon={ReceiptText} /><EBBillShare key={`meb-${refreshKey}`} /><WaterBillShare key={`mwater-${refreshKey}`} /></section>}
      {section === 'tools' && <section className="space-y-3" id={`tenant-${tool}`}><SectionTitle title="Tools" icon={Settings} /><div className="flex gap-2 overflow-x-auto pb-1"><ToolTab active={tool==='calendar'} onClick={()=>setTool('calendar')} icon={CalendarDays} label="Calendar" />{tenantCan(user,'community')&&<ToolTab active={tool==='community'} onClick={()=>setTool('community')} icon={MessagesSquare} label="Community"/>}{tenantCan(user,'blueprint')&&<ToolTab active={tool==='blueprint'} onClick={()=>setTool('blueprint')} icon={Map} label="Blueprint"/>}</div><div className="min-w-0">{tool==='calendar' && tenantCan(user,'calendar') && <><IndiaCalendar compact /><WasteSchedule /></>} {tool==='community' && tenantCan(user,'community') && <CommunityBoard user={user}/>} {tool==='blueprint' && tenantCan(user,'blueprint') && <BlueprintManager />}</div></section>}
      {section === 'more' && <section className="space-y-3"><SectionTitle title="More services" icon={FileText} /><div className="space-y-3">{tenantCan(user,'complaints')&&<RaiseComplaint/>}{tenantCan(user,'directory')&&<Directory/>}{tenantCan(user,'serviceContacts')&&<ServiceContacts/>}{tenantCan(user,'documents')&&<DocumentUpload/>}{tenantCan(user,'maintenance')&&<div className="rm-card p-4"><MaintenanceRequest/></div>}{tenantCan(user,'visitors')&&<div className="rm-card p-4"><VisitorLog/></div>}{tenantCan(user,'commonArea')&&<div className="rm-card p-4"><BookCommonArea/></div>}{tenantCan(user,'community')&&<CommunityBoard user={user}/>} {tenantCan(user,'community')&&<WifiShareBoard/>}{isPrimary(user)&&tenantCan(user,'family')&&<FamilyAccounts/>}{isSubAccount(user)&&<FamilyAccessNotice/>}</div></section>}
    </main>
    <nav className="tenant-mobile-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper-raised/96 backdrop-blur-xl border-t border-[var(--rm-border)] grid grid-cols-4" aria-label="Tenant quick navigation" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <MobileNavButton active={section==='home'} icon={Home} label="Home" onClick={()=>go('home')} />
      <MobileNavButton active={section==='rent'} icon={IndianRupee} label="Rent" onClick={()=>go('rent')} disabled={!tenantCan(user,'rent')} />
      <MobileNavButton active={section==='bills'} icon={ReceiptText} label="Bills" onClick={()=>go('bills')} disabled={!tenantCan(user,'bills')} />
      <MobileNavButton active={section==='more' || section==='tools'} icon={Settings} label="More" onClick={()=>setMoreOpen(v=>!v)} />
    </nav>
    {moreOpen && <div className="fixed bottom-[72px] right-3 z-50 w-48 rm-card p-2 shadow-2xl"><button className="w-full text-left rounded-xl px-3 py-3 text-sm font-semibold hover:bg-paper" onClick={()=>go('tools','calendar')}>Calendar & tools</button><button className="w-full text-left rounded-xl px-3 py-3 text-sm font-semibold hover:bg-paper" onClick={()=>go('more')}>More services</button></div>}
  </>
}

function QuickTile({ icon: Icon, label, onClick }) { return <button onClick={onClick} className="rm-card p-3 text-center min-w-0"><span className="mx-auto w-10 h-10 rounded-xl bg-brand/10 text-brand grid place-items-center"><Icon size={18}/></span><span className="block text-xs font-bold text-ink mt-2 truncate">{label}</span></button> }
function ToolTab({ active, icon: Icon, label, onClick }) { return <button onClick={onClick} className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold border ${active?'bg-brand text-white border-brand':'bg-paper-raised text-ink-soft border-[var(--rm-border)]'}`}><Icon size={14}/>{label}</button> }
function MobileNavButton({ active, icon: Icon, label, onClick, disabled }) { return <button disabled={disabled} onClick={onClick} className={`min-w-0 min-h-16 flex flex-col items-center justify-center gap-1 text-[10px] font-bold ${active?'text-brand':'text-ink-soft'} disabled:opacity-35`} aria-current={active?'page':undefined}><span className={`w-9 h-7 rounded-lg grid place-items-center ${active?'bg-brand/10':''}`}><Icon size={18}/></span>{label}</button> }
function SectionTitle({ title, icon: Icon }) { return <div className="flex items-center gap-2 px-1"><span className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center"><Icon size={18}/></span><h2 className="font-display text-xl font-extrabold">{title}</h2></div> }
function isSubAccount(user) { return user?.role === 'tenant' && user?.accountType === 'sub' }
function isPrimary(user) { return user?.role === 'tenant' && user?.accountType !== 'sub' }
function FamilyAccessNotice() { return <div className="rounded-2xl border border-brand/10 bg-brand/5 p-4 text-sm text-ink-soft">Some household tools are hidden by the main tenant. Ask the main account holder to enable access in Family accounts.</div> }
