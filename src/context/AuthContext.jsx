import { createContext, useContext, useEffect, useState } from 'react'
import { watchAuthState, handleGoogleRedirectResult } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    // Picks up the result if the user just came back from a Google redirect
    // sign-in (mobile/in-app browser flow). Safe to call even if there's nothing
    // to resolve — it just resolves to null.
    handleGoogleRedirectResult().catch(() => {})
    const unsub = watchAuthState(setUser)
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
