import React from 'react'

/**
 * Versatile skeleton loading placeholder with ledger-themed shimmer.
 * @param {'rect'|'circle'} variant - Shape variant
 * @param {string} className - Size and shape classes
 */
export function Skeleton({ variant = 'rect', className = '' }) {
  const base = 'animate-pulse bg-brass/10'
  const shape = variant === 'circle' ? 'rounded-full' : 'rounded-lg'
  return <div className={`${base} ${shape} ${className}`} aria-hidden="true" />
}

/**
 * Pre-built card skeleton matching the house/tenant card pattern.
 */
export function SkeletonCard() {
  return (
    <div className="bg-paper-raised rounded-2xl border border-brass/20 shadow-sm p-4 space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  )
}

export default Skeleton
