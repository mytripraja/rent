import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './modules/shared/ui/Toast'
import LoginPage from './modules/shared/LoginPage'
import ProtectedRoute from './modules/shared/ProtectedRoute'
import LoadingScreen from './modules/shared/LoadingScreen'
import OwnerDashboard from './modules/owner/OwnerDashboard'
import TenantDashboard from './modules/tenant/TenantDashboard'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'owner' || user.role === 'admin' ? '/owner' : '/tenant'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/owner/*"
              element={
                <ProtectedRoute role="owner">
                  <OwnerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenant/*"
              element={
                <ProtectedRoute role="tenant">
                  <TenantDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
