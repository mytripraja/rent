import React, { useEffect, useRef, useState, Suspense } from 'react'
import { CalendarDays, FileText, Home, IndianRupee, LogOut, Map, Newspaper, ReceiptText, Settings, UsersRound } from 'lucide-react'

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
const NewsHub = React.lazy(() => import('../shared/NewsHub'))
const WasteSchedule = React.lazy(() => import('../shared/WasteSchedule'))
const BlueprintManager = React.lazy(() => import('../owner/BlueprintManager'))
import LoadingScreen from '../shared/LoadingScreen'
import PullToRefresh from '../shared/ui/PullToRefresh'
import IconButton from '../shared/ui/IconButton'
import ThemeToggle from '../shared/ui/ThemeToggle'
import InstallAppPrompt from '../shared/ui/InstallAppPrompt'
import UserSettingsModal from '../shared/UserSettingsModal'
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

  async function handleRefresh() { setRefreshKey(k => k + 1); await new Promise(r => setTimeout(r, 500)) }

  return <div className="min-h-screen bg-paper">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className="bg-cover text-paper px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-brass/30 border border-brass overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden="true">{user?.name?.[0]}</div>
        <div className="min-w-0"><h1 className="font-display text-base sm:text-lg leading-tight truncate">Welcome, {user?.name}</h1><p className="text-[11px] sm:text-xs text-brass-light truncate">Customer ID {user?.customerId}</p></div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => setSettingsOpen(true)} className="w-10 h-10 rounded-xl hover:bg-white/10 grid place-items-center" aria-label="Open Settings"><Settings size={19}/></button>
        <ThemeToggle />
        <IconButton icon={LogOut} label="Log out" onClick={logout} />
      </div>
    </header>

    <PullToRefresh onRefresh={handleRefresh}>
      <Suspense fallback={<LoadingScreen />}>
        {isMobile ? <MobileTenantContent user={user} refreshKey={refreshKey} setRefreshKey={setRefreshKey} /> : <DesktopTenantContent user={user} refreshKey={refreshKey} setRefreshKey={setRefreshKey} />}
      </Suspense>
    </PullToRefresh>

    <InstallAppPrompt />
    <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </div>
}

function DesktopTenantContent({ user, refreshKey, setRefreshKey }) {
  const payRef = useRef(null)
  return <>
    <div id="tenant-home" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 scroll-mt-4">
      {tenantCan(user, 'rent') && <TenantRentHero key={`hero-${refreshKey}`} onPayNow={() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />}
      {tenantCan(user, 'rent') && <RentRevisionBanner />}
      {tenantCan(user, 'notices') && <NoticeFeed />}
    </div>
    <main id="main-content" tabIndex={-1} className="px-4 sm:px-6 pb-24 lg:pb-8 max-w-7xl mx-auto space-y-6 scroll-mt-4">
      {tenantCan(user, 'rent') && <div id="tenant-rent" ref={payRef} className="grid md:grid-cols-2 gap-4"> <RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} /><RentHistory key={`history-${refreshKey}`} /></div>}
      {tenantCan(user, 'bills') && <section id="tenant-bills" className="space-y-4"><EBBillShare key={`eb-${refreshKey}`} /><WaterBillShare key={`water-${refreshKey}`} /></section>}
      <section id="tenant-more" aria-labelledby="more-heading"><h2 id="more-heading" className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">More</h2><div className="grid md:grid-cols-2 gap-4">
        {tenantCan(user, 'complaints') && <RaiseComplaint />}{tenantCan(user, 'rent') && <RentAgreementView />}{tenantCan(user, 'directory') && <Directory />}{tenantCan(user, 'serviceContacts') && <ServiceContacts />}{tenantCan(user, 'documents') && <DocumentUpload />}{tenantCan(user, 'blueprint') && <div id="tenant-blueprint"><BlueprintManager /></div>}{tenantCan(user, 'maintenance') && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><MaintenanceRequest /></div>}{tenantCan(user, 'visitors') && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><VisitorLog /></div>}{tenantCan(user, 'commonArea') && <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><BookCommonArea /></div>}{isSubAccount(user) && <FamilyAccessNotice />}
      </div></section>
      {tenantCan(user, 'calendar') && <div id="tenant-calendar" className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,.75fr)] gap-4 items-start"><div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><IndiaCalendar compact /></div><div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-5"><WasteSchedule /></div></div>}
      {tenantCan(user, 'community') && <CommunityBoard user={user} />}{tenantCan(user, 'community') && <WifiShareBoard />}{tenantCan(user, 'news') && <div id="tenant-news"><NewsHub /></div>}{isPrimary(user) && tenantCan(user, 'family') && <FamilyAccounts />}
      <footer className="text-center text-xs text-ink-soft py-4 border-t border-brass/15">Need help? Check <span className="font-medium text-ink">Service Contacts</span> above, or raise a complaint and the owner will reach out.</footer>
    </main>
  </>
}

function MobileTenantContent({ user, refreshKey, setRefreshKey }) {
  const [section, setSection] = useState('home')
  const [tool, setTool] = useState('calendar')
  const [moreOpen, setMoreOpen] = useState(false)
  const go = (next, nextTool) => { setSection(next); if (nextTool) setTool(nextTool); setMoreOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <>
    <main id="main-content" tabIndex={-1} className="px-3 pt-3 pb-24 max-w-xl mx-auto space-y-3">
      {section === 'home' && <>
        {tenantCan(user, 'rent') && <TenantRentHero key={`mhero-${refreshKey}`} onPayNow={() => go('rent')} />}
        {tenantCan(user, 'rent') && <RentRevisionBanner />}
        {tenantCan(user, 'notices') && <NoticeFeed />}
        <div className="grid grid-cols-3 gap-2">
          {tenantCan(user, 'calendar') && <QuickTile icon={CalendarDays} label="Calendar" onClick={() => go('tools','calendar')} />}
          {tenantCan(user, 'blueprint') && <QuickTile icon={Map} label="Blueprint" onClick={() => go('tools','blueprint')} />}
          {tenantCan(user, 'news') && <QuickTile icon={Newspaper} label="News" onClick={() => go('tools','news')} />}
        </div>
        <div className="rm-card p-4"><div className="flex items-center gap-2"><UsersRound size={18} className="text-brand"/><div><h2 className="font-bold text-ink">Your home dashboard</h2><p className="text-xs text-ink-soft mt-0.5">Use the bottom navigation instead of scrolling through one long page.</p></div></div></div>
      </>}

      {section === 'rent' && tenantCan(user, 'rent') && <section className="space-y-3"><SectionTitle title="Rent & payment" icon={IndianRupee} /><RentSubmission onSubmitted={() => setRefreshKey(k => k + 1)} /><RentHistory key={`mrent-${refreshKey}`} />{tenantCan(user, 'rent') && <RentAgreementView />}</section>}
      {section === 'bills' && tenantCan(user, 'bills') && <section className="space-y-3"><SectionTitle title="Bills" icon={ReceiptText} /><EBBillShare key={`meb-${refreshKey}`} /><WaterBillShare key={`mwater-${refreshKey}`} /></section>}
      {section === 'tools' && <section className="space-y-3" id={`tenant-${tool}`}><SectionTitle title="Tools" icon={Settings} /><div className="flex gap-2 overflow-x-auto pb-1"><ToolTab active={tool==='calendar'} onClick={()=>setTool('calendar')} icon={CalendarDays} label="Calendar" />{tenantCan(user,'blueprint')&&<ToolTab active={tool==='blueprint'} onClick={()=>setTool('blueprint')} icon={Map} label="Blueprint"/>}{tenantCan(user,'news')&&<ToolTab active={tool==='news'} onClick={()=>setTool('news')} icon={Newspaper} label="News"/>}</div><div className="min-w-0">{tool==='calendar' && tenantCan(user,'calendar') && <><IndiaCalendar compact /><WasteSchedule /></>}{tool==='blueprint' && tenantCan(user,'blueprint') && <BlueprintManager />}{tool==='news' && tenantCan(user,'news') && <NewsHub />}</div></section>}
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
