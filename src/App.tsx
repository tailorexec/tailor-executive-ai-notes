import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Spinner } from './components/ui'
import { AppShell } from './layouts/AppShell'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { NoteDetail } from './pages/NoteDetail'
import { Capture } from './pages/Capture'
import { Dialer } from './pages/Dialer'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import type { ReactNode } from 'react'

function FullscreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-surface-bg">
      <Spinner size={28} className="text-brand-500" />
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullscreenLoader />
  if (!profile) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <FullscreenLoader />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { profile, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullscreenLoader /> : profile ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/cadastro"
        element={loading ? <FullscreenLoader /> : profile ? <Navigate to="/" replace /> : <Register />}
      />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/nota/:id" element={<NoteDetail />} />
        <Route path="/capturar" element={<Capture />} />
        <Route path="/discador" element={<Dialer />} />
        <Route path="/config" element={<Settings />} />
        <Route
          path="/admin"
          element={
            <AdminOnly>
              <Admin />
            </AdminOnly>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
