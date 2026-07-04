import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Spinner } from './components/ui'
import { AppShell } from './layouts/AppShell'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { TasksPage } from './pages/Tasks'
import { NoteDetail } from './pages/NoteDetail'
import { Capture } from './pages/Capture'
import { Dialer } from './pages/Dialer'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import { TrashPage } from './pages/Trash'
import { Help } from './pages/Help'
import { Terms } from './pages/Terms'
import { Privacy } from './pages/Privacy'
import { Support } from './pages/Support'
import { NotificationsPage } from './pages/Notifications'
import type { ReactNode } from 'react'

function FullscreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-surface-bg">
      <Spinner size={28} className="text-accent" />
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
        <Route path="/tarefas" element={<TasksPage />} />
        <Route path="/nota/:id" element={<NoteDetail />} />
        <Route path="/capturar" element={<Capture />} />
        <Route path="/discador" element={<Dialer />} />
        <Route path="/config" element={<Settings />} />
        <Route path="/lixeira" element={<TrashPage />} />
        <Route path="/ajuda" element={<Help />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/suporte" element={<Support />} />
        <Route path="/notificacoes" element={<NotificationsPage />} />
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
