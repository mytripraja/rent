import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>
  if (!user) return <Navigate to="/login" replace />

  // "owner" routes admit both co-owners and the super-admin — they share the
  // same dashboard, just with an extra Owner Management tab for admins only.
  const isOwnerLevel = user.role === 'owner' || user.role === 'admin'
  if (role === 'owner' && !isOwnerLevel) return <Navigate to="/" replace />
  if (role === 'tenant' && user.role !== 'tenant') return <Navigate to="/" replace />

  return children
}
