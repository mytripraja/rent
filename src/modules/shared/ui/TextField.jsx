import { useId } from 'react'

/**
 * Accessible, consistently-styled text input.
 * - label is always programmatically associated via htmlFor/id (not just visual proximity)
 * - error is announced via aria-describedby + role="alert" so screen readers catch it immediately
 * - hint text (non-error help) also wired via aria-describedby
 */
export default function TextField({
  label,
  hint,
  error,
  type = 'text',
  required,
  className = '',
  ...inputProps
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm text-ink-soft">
        {label}
        {required && <span className="text-stamp-red" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-sm text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-brand ${
          error ? 'border-stamp-red' : 'border-brass/30'
        }`}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-soft mt-1">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-stamp-red mt-1 flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  )
}
