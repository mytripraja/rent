import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Building2, Eye, EyeOff } from 'lucide-react'
import { login, loginWithGoogle, loginWithCustomerId, resetPassword, getLoginGuard, recordFailedLogin, isWrongPasswordError } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import TextField from './ui/TextField'
import Button from './ui/Button'
import { requestNotificationPermission } from '../../services/pushService'
import { getAppCheckHeader, auth } from '../../services/firebase'
import { confirmPasswordReset, getMultiFactorResolver, TotpMultiFactorGenerator, verifyPasswordResetCode } from 'firebase/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CUSTOMER_ID_RE = /^RM\d+$/i

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth(); const navigate = useNavigate(); const location = useLocation()
  const [method, setMethod] = useState('email'); const [email, setEmail] = useState(''); const [customerId, setCustomerId] = useState(''); const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({}); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [attemptsLeft, setAttemptsLeft] = useState(null); const [lockedUntil, setLockedUntil] = useState(0); const [legal, setLegal] = useState(false)
  const [mfaResolver, setMfaResolver] = useState(null); const [mfaCode, setMfaCode] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false); const [resetEmail, setResetEmail] = useState(''); const [resetMessage, setResetMessage] = useState(''); const [resetError, setResetError] = useState(''); const [resetLoading, setResetLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetCode, setResetCode] = useState(''); const [resetPasswordValue, setResetPasswordValue] = useState(''); const [resetPasswordConfirm, setResetPasswordConfirm] = useState(''); const [resetPasswordComplete, setResetPasswordComplete] = useState(false)
  const [redirecting, setRedirecting] = useState(false); const [resetCodeChecking, setResetCodeChecking] = useState(false)
  const signInStarted = useRef(false)
  const status = new URLSearchParams(location.search).get('status')
  const requestedReturn = new URLSearchParams(location.search).get('returnTo')
  const isAccessDenied = status === 'access-denied'
  const isSessionExpired = status === 'session-expired'

  useEffect(() => { if (!authLoading && user && !isAccessDenied) {
    const roleHome = user.role === 'owner' || user.role === 'admin' ? '/owner' : '/tenant'
    const correctRolePath = (user.role === 'owner' || user.role === 'admin') ? (requestedReturn === '/owner' || requestedReturn?.startsWith('/owner/')) : (requestedReturn === '/tenant' || requestedReturn?.startsWith('/tenant/'))
    const safeReturn = correctRolePath && !requestedReturn.startsWith('//') ? requestedReturn : roleHome
    if (signInStarted.current) { setRedirecting(true); const timer = setTimeout(() => navigate(safeReturn, { replace: true }), 900); return () => clearTimeout(timer) }
    navigate(safeReturn, { replace: true })
  } }, [authLoading, user, navigate, isAccessDenied, requestedReturn])
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('oobCode')
    if (params.get('mode') !== 'resetPassword' || !code) return
    setResetCode(code); setResetCodeChecking(true)
    verifyPasswordResetCode(auth, code).then(setResetEmail).catch(() => setResetError('This password reset link is invalid or has expired. Request a new link to continue.')).finally(() => setResetCodeChecking(false))
  }, [location.search])
  useEffect(() => { if (sessionStorage.getItem('rm_legal_ack') === '1') setLegal(true) }, [])

  const emailError = touched.email && email && !EMAIL_RE.test(email) ? 'Enter a valid email address.' : ''
  const customerIdError = touched.customerId && customerId && !CUSTOMER_ID_RE.test(customerId.trim()) ? 'Customer ID looks like RM1001.' : ''
  const passwordError = touched.password && password && password.length < 6 ? 'Password should be at least 6 characters.' : ''
  function markTouched(field) { setTouched(t => ({ ...t, [field]: true })) }
  async function handleResetPassword(e) { e.preventDefault(); setResetMessage(''); setResetError(''); setResetLoading(true); try { await resetPassword(resetEmail); setResetMessage('Password reset email sent. Check your inbox.') } catch (err) { setResetError(err.message || 'Failed to send reset email.') } finally { setResetLoading(false) } }
  async function handleCompletePasswordReset(e) { e.preventDefault(); setResetError(''); if (resetPasswordValue.length < 8) { setResetError('Use at least 8 characters for your new password.'); return } if (resetPasswordValue !== resetPasswordConfirm) { setResetError('Passwords do not match.'); return } setResetLoading(true); try { await confirmPasswordReset(auth, resetCode, resetPasswordValue); setResetPasswordComplete(true); setResetMessage('Your password has been updated. You can now sign in.'); setResetPasswordValue(''); setResetPasswordConfirm('') } catch (err) { setResetError(err.message || 'Unable to reset password. Request a new reset link and try again.') } finally { setResetLoading(false) } }
  function formatLockTime(until) {
    const minutes = Math.max(1, Math.ceil((Number(until || 0) - Date.now()) / 60000))
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }

  async function checkLoginGuard(identifier) {
    const guard = await getLoginGuard(identifier)
    setAttemptsLeft(Number.isFinite(guard?.remaining) ? guard.remaining : 3)
    setLockedUntil(Number(guard?.lockedUntil || 0))
    if (guard?.locked && guard.lockedUntil > Date.now()) {
      throw new Error(`This sign-in is temporarily locked. Try again in ${formatLockTime(guard.lockedUntil)}.`)
    }
  }

  async function handlePasswordFailure(identifier, err, label) {
    if (!isWrongPasswordError(err)) return false
    const guard = await recordFailedLogin(identifier)
    setAttemptsLeft(Number.isFinite(guard?.remaining) ? guard.remaining : 0)
    setLockedUntil(Number(guard?.lockedUntil || 0))
    if (guard?.locked) {
      setError(`Password is wrong. Your account is temporarily locked for 15 minutes. Use Forgot password if you need to reset it.`)
    } else {
      setError(`Password is wrong. ${guard?.remaining ?? 0} attempt${guard?.remaining === 1 ? '' : 's'} left.`)
    }
    return true
  }

  async function finishMfa() {
    if (!mfaResolver || mfaCode.length !== 6) return
    setLoading(true); setError('')
    try {
      const hint = mfaResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) || mfaResolver.hints[0]
      if (!hint || hint.factorId !== TotpMultiFactorGenerator.FACTOR_ID) throw new Error('This account uses a second factor that this browser flow does not support yet.')
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode)
      signInStarted.current = true
      await mfaResolver.resolveSignIn(assertion)
      setMfaResolver(null); setMfaCode(''); requestNotificationPermission()
    } catch (e) { signInStarted.current = false; setError(e.message || 'The authenticator code is incorrect or expired.') } finally { setLoading(false) }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault(); if (!legal) return; setError(''); setLoading(true)
    try {
      sessionStorage.setItem('rm_legal_ack','1')
      await checkLoginGuard(email)
      signInStarted.current = true
      await login(email,password)
      setAttemptsLeft(3); setLockedUntil(0)
      requestNotificationPermission()
    } catch (err) {
      if (err?.code === 'auth/multi-factor-auth-required') { signInStarted.current = false; setMfaResolver(getMultiFactorResolver(auth, err)); setMfaCode(''); setError('Enter the 6-digit code from your authenticator app.') }
      else { signInStarted.current = false; const handled = await handlePasswordFailure(email, err, 'email'); if (!handled) setError(err.message || 'Login failed. Check your email and password.') }
    } finally { setLoading(false) }
  }

  async function handleCustomerIdSubmit(e) {
    e.preventDefault(); if (!legal) return; setError(''); setLoading(true)
    let resolvedEmail = ''
    try {
      sessionStorage.setItem('rm_legal_ack','1')
      const lookup = await fetch('/api/resolve-customer-id', { method:'POST', headers:{'Content-Type':'application/json', ...(await getAppCheckHeader())}, body:JSON.stringify({customerId:customerId.trim().toUpperCase()}) })
      const data = await lookup.json().catch(()=>({}))
      if (!lookup.ok || !data.email) throw new Error(data.error || 'No account found for that Customer ID.')
      resolvedEmail = data.email
      await checkLoginGuard(resolvedEmail)
      signInStarted.current = true
      await loginWithCustomerId(customerId,password)
      setAttemptsLeft(3); setLockedUntil(0)
      requestNotificationPermission()
    } catch (err) {
      if (err?.code === 'auth/multi-factor-auth-required') { signInStarted.current = false; setMfaResolver(getMultiFactorResolver(auth, err)); setMfaCode(''); setError('Enter the 6-digit code from your authenticator app.') }
      else { signInStarted.current = false; const identifier = resolvedEmail || customerId.trim().toUpperCase(); const handled = await handlePasswordFailure(identifier, err, 'customerId'); if (!handled) setError(err.message || 'Login failed. Check your Customer ID and password.') }
    } finally { setLoading(false) }
  }
  async function handleGoogleClick() { if (!legal) return; setError(''); setLoading(true); sessionStorage.setItem('rm_legal_ack','1'); try { signInStarted.current = true; await loginWithGoogle(); requestNotificationPermission() } catch (err) { signInStarted.current = false; if (err?.code === 'auth/multi-factor-auth-required') { setMfaResolver(getMultiFactorResolver(auth, err)); setMfaCode(''); setError('Enter the 6-digit code from your authenticator app.') } else setError(err.message || 'Google sign-in failed.') } finally { setLoading(false) } }

  const workspacePath = user?.role === 'owner' || user?.role === 'admin' ? '/owner' : '/tenant'
  const isProcessing = (loading || signInStarted.current) && !mfaResolver && !redirecting
  const pageTitle = isAccessDenied ? 'Access denied' : isSessionExpired ? 'Session expired' : resetCode ? 'Reset password' : showForgotPassword ? 'Reset password' : 'Welcome back'
  const pageSubtitle = isAccessDenied ? 'Your role does not have permission for this workspace.' : isSessionExpired ? 'Sign in again to continue safely.' : resetCode ? `Create a new password${resetEmail ? ` for ${resetEmail}` : ''}.` : showForgotPassword ? 'Enter the email attached to your Rental Manager account.' : 'Sign in to manage your home, with clarity.'

  return <main className="rm-auth min-h-[100dvh] bg-[#f7f8fa] px-5 py-7 text-[#17211b] sm:px-8">
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[430px] flex-col">
      <div className="flex items-center justify-between text-xs text-[#667085]"><Link to="/" className="inline-flex items-center gap-2 font-semibold"><ArrowLeft size={15}/> Home</Link><Link to="/privacy" className="font-semibold">Privacy</Link></div>
      {redirecting ? <div className="my-auto py-8">
        <header className="mb-6"><p className="mb-1 text-[11px] font-semibold tracking-[.09em] text-[#166534]">RENTAL MANAGER</p><h1 className="text-2xl font-semibold">Success</h1><p className="mt-1 text-[13px] text-[#667085]">You are signed in as {user?.name || user?.displayName || 'a Rental Manager user'} — {user?.role === 'owner' || user?.role === 'admin' ? 'Property Manager' : 'Tenant'}.</p></header>
        <section className="rounded-xl border border-[#e4e7ec] bg-white p-5 text-center shadow-[0_2px_4px_rgba(23,33,27,.03)]"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-50 text-[#166534]"><Building2 size={26}/></div><p className="font-semibold">Redirecting to your workspace</p><p className="mt-2 text-xs text-[#667085]">You’ll be redirected to the {user?.role === 'owner' || user?.role === 'admin' ? 'Property Manager' : 'Tenant'} dashboard.</p><span className="rm-auth-spinner mt-5" aria-label="Redirecting"/></section>
      </div> : <div className="my-auto py-8">
        <header className="mb-6"><p className="mb-1 text-[11px] font-semibold tracking-[.09em] text-[#166534]">RENTAL MANAGER</p><h1 className="text-2xl font-semibold leading-[1.45]">{pageTitle}</h1><p className="mt-1 text-[13px] leading-[1.45] text-[#667085]">{pageSubtitle}</p></header>
        <section className="rounded-xl border border-[#e4e7ec] bg-white p-5 shadow-[0_2px_4px_rgba(23,33,27,.03)]">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center text-[#166534]"><Building2 size={29} strokeWidth={1.8}/></span><p className="text-xl font-semibold">Rental Manager</p></div>
          {isAccessDenied && <div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">Your account is signed in, but it cannot open the requested workspace.</div><button type="button" onClick={()=>navigate(workspacePath,{replace:true})} className="rm-auth-primary">Return to my workspace</button></div>}
          {isProcessing && !isAccessDenied && <div className="py-5 text-center" role="status" aria-live="polite"><span className="rm-auth-spinner mb-4" aria-hidden="true"/><h2 className="text-lg font-semibold">Signing in</h2><p className="mt-1 text-sm text-[#667085]">Verifying your account and workspace access.</p><p className="mt-4 text-xs text-[#667085]">This may take a moment.</p></div>}
          {mfaResolver && <div className="space-y-3" role="dialog" aria-labelledby="mfa-title"><div><p id="mfa-title" className="font-semibold">Authenticator verification</p><p className="mt-1 text-xs text-[#667085]">Enter the current 6-digit code from your authenticator app.</p></div><input autoFocus inputMode="numeric" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,''))} className="w-full rounded-lg border border-[#e4e7ec] p-3 text-center text-lg tracking-[.4em]" placeholder="000000" aria-label="Authenticator code"/><button type="button" onClick={finishMfa} disabled={loading || mfaCode.length !== 6} className="rm-auth-primary">{loading?'Verifying…':'Verify code'}</button><button type="button" onClick={()=>{setMfaResolver(null);setMfaCode('');setError('')}} className="w-full text-xs font-semibold text-[#667085]">Cancel</button></div>}
          {!isProcessing && !mfaResolver && resetCode && <form onSubmit={handleCompletePasswordReset} className="space-y-4" noValidate>{resetCodeChecking ? <p className="text-sm text-[#667085]" role="status">Checking your secure reset link…</p> : resetPasswordComplete ? <><p className="text-sm text-[#166534]" role="status">{resetMessage}</p><Button type="button" fullWidth onClick={()=>navigate('/login',{replace:true})} className="rm-auth-primary">Back to sign in</Button></> : resetError && !resetEmail ? <><p className="text-sm text-red-600" role="alert">{resetError}</p><button type="button" onClick={()=>navigate('/login',{replace:true})} className="rm-auth-primary">Return to sign in</button></> : <><TextField label="New password" type={showPassword?'text':'password'} required autoComplete="new-password" value={resetPasswordValue} onChange={e=>setResetPasswordValue(e.target.value)} hint="Use at least 8 characters."/><TextField label="Confirm password" type={showPassword?'text':'password'} required autoComplete="new-password" value={resetPasswordConfirm} onChange={e=>setResetPasswordConfirm(e.target.value)} error={resetPasswordConfirm && resetPasswordConfirm !== resetPasswordValue ? 'Passwords do not match.' : ''}/><p className="text-xs text-[#667085]">Use the same password for future sign-ins.</p>{resetError&&<p className="text-sm text-red-600" role="alert">{resetError}</p>}<Button type="submit" fullWidth loading={resetLoading} loadingText="Updating password…" className="rm-auth-primary">Update password</Button></>}</form>}
          {!isProcessing && !mfaResolver && !resetCode && !isAccessDenied && method==='email' && !showForgotPassword && <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
            <TextField label="Email" type="email" required inputMode="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>markTouched('email')} error={emailError}/>
            <div className="relative"><TextField label="Password" type={showPassword?'text':'password'} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>markTouched('password')} error={passwordError}/><button type="button" className="rm-auth-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
            <button type="button" onClick={()=>{setShowForgotPassword(true);setResetEmail(email);setResetMessage('');setResetError('')}} className="block text-[13px] font-semibold text-[#166534]">Forgot password?</button>
            {error&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert" aria-live="assertive"><strong>{error}</strong>{attemptsLeft !== null && !lockedUntil && <span className="mt-1 block text-xs">Remaining password attempts: {attemptsLeft}.</span>}</div>}
            <LegalCheck checked={legal} onChange={setLegal}/><Button type="submit" fullWidth loading={loading} loadingText="Signing in…" disabled={!legal} className="rm-auth-primary">Sign in</Button>
          </form>}
          {!isProcessing && !mfaResolver && !resetCode && !isAccessDenied && method==='email' && showForgotPassword && <form onSubmit={handleResetPassword} className="space-y-4" noValidate><TextField label="Email" type="email" required inputMode="email" autoComplete="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)}/><p className="text-xs leading-5 text-[#667085]">We’ll send a secure reset link to the account on file.</p>{resetMessage&&<p className="text-sm text-[#166534]" role="status">{resetMessage}</p>}{resetError&&<p className="text-sm text-red-600" role="alert">{resetError}</p>}<Button type="submit" fullWidth loading={resetLoading} loadingText="Sending…" className="rm-auth-primary">Send reset link</Button><button type="button" onClick={()=>setShowForgotPassword(false)} className="w-full text-sm font-semibold text-[#667085]">Back to sign in</button></form>}
          {!isProcessing && !mfaResolver && !resetCode && !isAccessDenied && method==='customerId' && <form onSubmit={handleCustomerIdSubmit} className="space-y-4" noValidate><TextField label="Customer ID" required autoCapitalize="characters" placeholder="RM1001" hint={!customerIdError?'e.g. RM1001 — given when your account was created':undefined} value={customerId} onChange={e=>setCustomerId(e.target.value)} onBlur={()=>markTouched('customerId')} error={customerIdError}/><TextField label="Password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>markTouched('password')} error={passwordError}/>{error&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</div>}<LegalCheck checked={legal} onChange={setLegal}/><Button type="submit" fullWidth loading={loading} loadingText="Signing in…" disabled={!legal} className="rm-auth-primary">Sign in</Button></form>}
          {!isProcessing && !mfaResolver && !resetCode && !isAccessDenied && method==='google' && <div className="space-y-4"><div className="rounded-lg bg-[#f7f8fa] p-3 text-sm leading-6 text-[#667085]">Your Google email must match the email authorised for your Rental Manager account.</div>{error&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</div>}<LegalCheck checked={legal} onChange={setLegal}/><button type="button" onClick={handleGoogleClick} disabled={loading||!legal} className="rm-auth-secondary"><GoogleIcon/>{loading?'Signing in…':'Continue with Google'}</button></div>}
        </section>
        {!isAccessDenied && <><p className="mt-4 text-center text-xs leading-[1.45] text-[#667085]">Use the account provided by your administrator. Your role determines your workspace.</p><div className="mt-5 flex justify-center gap-4 text-xs text-[#667085]"><button type="button" onClick={()=>{setMethod('customerId');setError('')}}>Use Customer ID</button><button type="button" onClick={()=>{setMethod('google');setError('')}}>Google sign in</button></div></>}
      </div>}
      {!redirecting && <footer className="pb-2 text-center text-xs leading-[1.45] text-[#667085]">Accounts are created by your property administrator.<br/><Link to="/privacy" className="mt-1 inline-block font-semibold text-[#166534]">Contact your property administrator</Link><p className="mt-3 text-[11px]">Private access · no public registration. By continuing, you accept the <Link to="/terms" className="underline">Terms</Link> and <Link to="/acceptable-use" className="underline">Acceptable Use</Link>.</p></footer>}
    </div>
  </main>
}
function LegalCheck({checked,onChange}){return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--rm-border)] bg-paper px-3 py-3 text-xs leading-5 text-ink-soft"><input type="checkbox" checked={checked} onChange={e=>{onChange(e.target.checked); if(e.target.checked) sessionStorage.setItem('rm_legal_ack','1'); else sessionStorage.removeItem('rm_legal_ack')}} className="mt-1 h-4 w-4 accent-[var(--color-brand)]"/><span>I have read and accept the <Link to="/terms" className="font-bold text-ink underline">Terms</Link> and <Link to="/privacy" className="font-bold text-ink underline">Privacy Notice</Link>.</span></label>}
function GoogleIcon(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.4 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.3C40.9 36.4 44 30.9 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>}

