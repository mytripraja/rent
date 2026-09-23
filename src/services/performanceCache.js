const cache = new Map()
const inflight = new Map()

export async function cachedRequest(key, loader, ttlMs = 15000) {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value
  if (inflight.has(key)) return inflight.get(key)
  const promise = Promise.resolve().then(loader).then(value => {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs })
    inflight.delete(key)
    return value
  }).catch(error => {
    inflight.delete(key)
    throw error
  })
  inflight.set(key, promise)
  return promise
}

export function invalidateCache(prefix = '') {
  for (const key of cache.keys()) if (!prefix || key.startsWith(prefix)) cache.delete(key)
}
