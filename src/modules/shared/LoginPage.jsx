import { useState } from 'react'
import { login, loginWithGoogle, loginWithCustomerId } from '../../services/authService'

const METHODS = [
  { id: 'email', label: 'Email' },
  { id: 'customerId', label: 'Customer ID' },
  { id: 'google', label: 'Google' },
]

export default function LoginPage() {
  const [method, setMethod] = useState('email')
  const [email, setEmail] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 sm:p-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Rental Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>

        {/* Method switcher - horizontally scrollable so it never breaks on small screens */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setMethod(m.id); setError('') }}
              className={`shrink-0 text-xs sm:text-sm px-3 py-2 rounded-lg font-medium whitespace-nowrap ${
                method === m.id ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <SubmitButton loading={loading}>Sign In</SubmitButton>
          </form>
        )}

        {method === 'customerId' && (
          <form onSubmit={handleCustomerIdSubmit} className="space-y-4">
            <Field label="Customer ID" hint="e.g. RM1001 — given to you when your account was created">
              <input
                required
                autoCapitalize="characters"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className={inputClass}
                placeholder="RM1001"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <SubmitButton loading={loading}>Sign In</SubmitButton>
          </form>
        )}

        {method === 'google' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Only works if your Google email matches the one on file with the owner.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <GoogleIcon />
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>
          </div>
        )}

        <p className="text-xs text-slate-400 text-center pt-1">
          Tenant accounts are created by the owner. Contact the owner if you don't have a login.
        </p>
      </div>
    </div>
  )
}

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-sm text-slate-600">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-brand hover:bg-brand-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
    >
      {loading ? 'Signing in…' : children}
    </button>
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
