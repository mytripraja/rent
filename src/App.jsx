import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './modules/shared/LoginPage'
import ProtectedRoute from './modules/shared/ProtectedRoute'
import OwnerDashboard from './modules/owner/OwnerDashboard'
import TenantDashboard from './modules/tenant/TenantDashboard'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'owner' || user.role === 'admin' ? '/owner' : '/tenant'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/owner"
            element={
              <ProtectedRoute role="owner">
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant"
            element={
              <ProtectedRoute role="tenant">
                <TenantDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
