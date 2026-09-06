import { useState } from 'react'
import { login, loginWithGoogle, loginWithCustomerId, resetPassword } from '../../services/authService'
import { useLanguage } from '../../context/LanguageContext'
import TextField from './ui/TextField'
import Button from './ui/Button'

const METHODS = [
  { id: 'email', label: 'Email' },
  { id: 'customerId', label: 'Customer ID' },
  { id: 'google', label: 'Google' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CUSTOMER_ID_RE = /^RM\d+$/i

export default function LoginPage() {
  const { t } = useLanguage()
  const [method, setMethod] = useState('email')
  const [email, setEmail] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleResetPassword(e) {
    e.preventDefault()
    setResetMessage('')
    setResetError('')
    setResetLoading(true)
    try {
      await resetPassword(resetEmail)
      setResetMessage('Password reset email sent! Check your inbox.')
    } catch (err) {
      setResetError(err.message || 'Failed to send reset email.')
    } finally {
      setResetLoading(false)
    }
  }

  // Instant, inline validation — checked as the person types/blurs, not just on submit.
  const emailError = touched.email && email && !EMAIL_RE.test(email) ? 'Enter a valid email address.' : ''
  const customerIdError = touched.customerId && customerId && !CUSTOMER_ID_RE.test(customerId.trim())
    ? 'Customer ID looks like RM1001 — letters "RM" followed by numbers.' : ''
  const passwordError = touched.password && password && password.length < 6 ? 'Password should be at least 6 characters.' : ''

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError('Login failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCustomerIdSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithCustomerId(customerId, password)
    } catch (err) {
      setError(err.message || 'Login failed. Check your Customer ID and password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleClick() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-sm bg-paper-raised rounded-2xl shadow-md border border-brass/20 p-6 sm:p-8 space-y-5">
        <div>
          <h1 className="font-display text-2xl text-ink">{t('appName')}</h1>
          <p className="text-sm text-ink-soft mt-1">Sign in to continue</p>
        </div>

        {/* Method switcher - horizontally scrollable so it never breaks on small screens */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Sign-in method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={method === m.id}
              onClick={() => { setMethod(m.id); setError(''); setTouched({}) }}
              className={`shrink-0 text-xs sm:text-sm px-3 py-2 rounded-lg font-medium whitespace-nowrap ${
                method === m.id ? 'bg-brand text-white' : 'bg-paper text-ink-soft border border-brass/20'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'email' && !showForgotPassword && (
          <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
            <TextField
              label="Email" type="email" required inputMode="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched('email')}
              error={emailError}
            />
            <TextField
              label="Password" type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => markTouched('password')}
              error={passwordError}
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" fullWidth loading={loading} loadingText="Signing in…">Sign In</Button>
            <button type="button" onClick={() => { setShowForgotPassword(true); setResetEmail(email); setResetMessage(''); setResetError(''); }} className="w-full text-sm text-brand hover:underline mt-2">
              Forgot password?
            </button>
          </form>
        )}

        {method === 'email' && showForgotPassword && (
          <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
            <p className="text-sm text-ink-soft">Enter your email to receive a password reset link.</p>
            <TextField
              label="Email" type="email" required inputMode="email"
              value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
            />
            {resetMessage && <p className="text-sm text-stamp-green" role="alert">{resetMessage}</p>}
            {resetError && <p className="text-sm text-red-600" role="alert">{resetError}</p>}
            <Button type="submit" fullWidth loading={resetLoading} loadingText="Sending…">Send Reset Link</Button>
            <button type="button" onClick={() => setShowForgotPassword(false)} className="w-full text-sm text-ink-soft hover:underline mt-2">
              Back to login
            </button>
          </form>
        )}

        {method === 'customerId' && (
          <form onSubmit={handleCustomerIdSubmit} className="space-y-4" noValidate>
            <TextField
              label="Customer ID" required autoCapitalize="characters" placeholder="RM1001"
              hint={!customerIdError ? 'e.g. RM1001 — given to you when your account was created' : undefined}
              value={customerId} onChange={(e) => setCustomerId(e.target.value)} onBlur={() => markTouched('customerId')}
              error={customerIdError}
            />
            <TextField
              label="Password" type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => markTouched('password')}
              error={passwordError}
            />
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" fullWidth loading={loading} loadingText="Signing in…">Sign In</Button>
          </form>
        )}

        {method === 'google' && (
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              Only works if your Google email matches the one on file with the owner.
            </p>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border border-brass/30 rounded-lg py-2.5 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
            >
              <GoogleIcon />
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>
          </div>
        )}

        <p className="text-xs text-ink-soft/80 text-center pt-1">
          Tenant accounts are created by the owner. Contact the owner if you don't have a login.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.4 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.3C40.9 36.4 44 30.9 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}
