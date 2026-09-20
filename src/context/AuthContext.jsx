import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { watchAuthState, handleGoogleRedirectResult } from '../services/authService'
import { db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profileRefresh, setProfileRefresh] = useState(0)

  useEffect(() => {
    handleGoogleRedirectResult().catch(() => {})
    let stopProfile = null
    const unsub = watchAuthState((nextUser) => {
      if (stopProfile) { stopProfile(); stopProfile = null }
      if (!nextUser) { setUser(null); return }
      // Keep role, appMode and tenant permissions live. This means an admin can
      // change a user's access or Simple/Full mode without requiring that user
      // to sign out and back in.
      stopProfile = onSnapshot(doc(db, 'users', nextUser.uid), (snap) => {
        setUser({ ...nextUser, ...(snap.exists() ? snap.data() : {}) })
      }, () => setUser(nextUser))
    })
    return () => { if (stopProfile) stopProfile(); unsub?.() }
  }, [profileRefresh])

  async function refreshUser() { setProfileRefresh(v => v + 1) }

  return <AuthContext.Provider value={{ user, loading: user === undefined, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
