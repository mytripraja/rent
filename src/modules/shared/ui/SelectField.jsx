import { useId } from 'react'

export default function SelectField({ label, hint, error, required, className = '', children, ...selectProps }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="text-sm text-ink-soft">
          {label}
          {required && <span className="text-stamp-red" aria-hidden="true"> *</span>}
        </label>
      )}
      <select
        id={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`${label ? 'mt-1' : ''} w-full rounded-lg border px-3 py-2.5 text-sm text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-brand ${
          error ? 'border-stamp-red' : 'border-brass/30'
        }`}
        {...selectProps}
      >
        {children}
      </select>
      {hint && !error && <p id={hintId} className="text-xs text-ink-soft mt-1">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-stamp-red mt-1">{error}</p>}
    </div>
  )
}
