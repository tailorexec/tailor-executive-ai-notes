import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { Spinner } from './components/ui'
import { AppShell } from './layouts/AppShell'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { TasksPage } from './pages/Tasks'
import { Agenda } from './pages/Agenda'
import { NoteDetail } from './pages/NoteDetail'
import { MindMapPage } from './pages/MindMap'
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
import { FriendsPage } from './pages/Friends'
import { SharedWithMePage } from './pages/SharedWithMe'
import { AnalyticsPage, ConnectorsPage } from './pages/ComingSoon'
import { About } from './pages/About'
import { EditProfile } from './pages/EditProfile'
import { ApiMonitor } from './pages/ApiMonitor'
import { AuditLogPage } from './pages/AuditLog'
import { InstallApp } from './pages/InstallApp'
import { isElectron } from './lib/electron'
import type { ReactNode } from 'react'

function FullscreenLoader() {
  return (
    <div className="min-h-dvh grid place-items-center bg-surface-bg">
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
  const navigate = useNavigate()

  // App Windows (Electron): o atalho global (Ctrl+Shift+G) traz a janela pra frente e cai
  // direto na tela de gravar reuniao -- so falta 1 clique em "Iniciar" (getUserMedia exige um
  // gesto real do usuario, entao nao da pra automatizar esse ultimo passo).
  useEffect(() => {
    if (!isElectron() || !profile) return
    return window.anaElectron!.onRecordHotkey(() => navigate('/capturar?mode=meeting'))
  }, [profile, navigate])

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
      {/* Publica de proposito (sem Protected): e o link que a gente compartilha pra alguem
          instalar o app antes mesmo de ter conta/logar. */}
      <Route path="/instalar" element={<InstallApp />} />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/tarefas" element={<TasksPage />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/nota/:id" element={<NoteDetail />} />
        <Route path="/nota/:id/mapa-mental" element={<MindMapPage />} />
        <Route path="/capturar" element={<Capture />} />
        <Route path="/discador" element={<Dialer />} />
        <Route path="/config" element={<Settings />} />
        <Route path="/lixeira" element={<TrashPage />} />
        <Route path="/ajuda" element={<Help />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/suporte" element={<Support />} />
        <Route path="/notificacoes" element={<NotificationsPage />} />
        <Route path="/amigos" element={<FriendsPage />} />
        <Route path="/compartilhados" element={<SharedWithMePage />} />
        <Route path="/conectores" element={<ConnectorsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/sobre" element={<About />} />
        <Route path="/perfil" element={<EditProfile />} />
        <Route
          path="/admin"
          element={
            <AdminOnly>
              <Admin />
            </AdminOnly>
          }
        />
        <Route
          path="/admin/api"
          element={
            <AdminOnly>
              <ApiMonitor />
            </AdminOnly>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <AdminOnly>
              <AuditLogPage />
            </AdminOnly>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
