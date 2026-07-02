import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, Phone, Settings as SettingsIcon, Sparkles, ShieldCheck, Mic, Bot } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from '../components/Logo'
import { Avatar } from '../components/ui'
import { AnnouncementBanner } from '../components/AnnouncementBanner'
import { useAppSettings } from '../app/SettingsProvider'
import { Maintenance } from '../pages/Maintenance'
import { HelpAssistant } from '../pages/HelpAssistant'

const HIDE_MOBILE_NAV_ON = ['/nota/', '/capturar', '/discador']

interface Item {
  to: string
  icon: React.ReactNode
  label: string
  adminOnly?: boolean
}

const ITEMS: Item[] = [
  { to: '/', icon: <Home size={20} />, label: 'Notas' },
  { to: '/discador', icon: <Phone size={20} />, label: 'Discador' },
  { to: '/admin', icon: <ShieldCheck size={20} />, label: 'Admin', adminOnly: true },
  { to: '/config', icon: <SettingsIcon size={20} />, label: 'Config' },
]

/* ---------- Desktop sidebar (SaaS layout) ---------- */
function Sidebar() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-surface-border bg-surface-card z-40">
      <div className="px-4 pt-7 pb-6 flex justify-center">
        <Logo size="sm" />
      </div>

      <button
        onClick={() => navigate('/capturar')}
        className="btn-primary mx-4 mb-6 py-3 rounded-2xl shadow-float"
      >
        <Sparkles size={18} />
        Gravação Inteligente
      </button>

      <p className="px-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Menu</p>
      <nav className="flex-1 px-3 space-y-1">
        {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500/10 text-brand-500'
                  : 'text-content-secondary hover:bg-surface-elevated hover:text-content-primary'
              }`
            }
          >
            {i.icon}
            {i.label}
          </NavLink>
        ))}
      </nav>

      {/* Card ANA: assistente de ajuda inteligente */}
      <div className="px-3 mb-3">
        <button
          onClick={() => setHelpOpen(true)}
          className="relative w-full overflow-hidden rounded-2xl p-[1.5px] group text-left"
        >
          <span className="absolute inset-0 bg-[linear-gradient(110deg,#941010,#F10C27,#640816,#F10C27,#941010)] bg-[length:200%_100%] animate-shine opacity-80 group-hover:opacity-100" />
          <span className="relative block rounded-2xl bg-surface-card px-3.5 py-3">
            <span className="flex items-center gap-2 mb-1">
              <span className="relative grid place-items-center h-7 w-7 rounded-lg bg-brand-500 text-white shrink-0">
                <span className="absolute inset-0 rounded-lg bg-brand-500 animate-ping opacity-30" />
                <Bot size={15} className="relative" />
              </span>
              <span className="text-sm font-semibold">Falar com a ANA</span>
            </span>
            <span className="block text-xs text-content-muted leading-snug">
              Sua assistente com PhD. Tire dúvidas sobre o app.
            </span>
          </span>
        </button>
      </div>

      <div className="p-3 border-t border-surface-border">
        <button onClick={() => navigate('/config')} className="flex items-center gap-3 w-full min-w-0 text-left">
          {profile && <Avatar first={profile.first_name} last={profile.last_name} size={36} url={profile.avatar_url} />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-content-muted truncate">{profile?.email}</p>
          </div>
        </button>
      </div>

      {helpOpen && <HelpAssistant open={helpOpen} onClose={() => setHelpOpen(false)} />}
    </aside>
  )
}

/* ---------- Mobile bottom nav (com estrela central) ---------- */
function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 flex-1 py-1.5 text-[11px] font-medium transition-colors ${
          isActive ? 'text-brand-500' : 'text-content-muted hover:text-content-secondary'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

function BottomNav() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <div className="relative flex items-center bg-surface-card/95 backdrop-blur border border-surface-border rounded-3xl shadow-float h-16 px-2">
          <NavItem to="/" icon={<Home size={20} />} label="Notas" />
          <NavItem to="/discador" icon={<Phone size={20} />} label="Discador" />

          <div className="flex-1 flex justify-center">
            <button
              onClick={() => navigate('/capturar')}
              aria-label="Gravar audio"
              className="grid place-items-center h-14 w-14 -mt-8 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-float ring-4 ring-surface-card transition-colors"
            >
              <Mic size={24} />
            </button>
          </div>

          {isAdmin ? (
            <NavItem to="/admin" icon={<ShieldCheck size={20} />} label="Admin" />
          ) : (
            <div className="flex-1" />
          )}
          <NavItem to="/config" icon={<SettingsIcon size={20} />} label="Config" />
        </div>
      </div>
    </nav>
  )
}

export function AppShell() {
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { settings } = useAppSettings()
  const hideMobileNav = HIDE_MOBILE_NAV_ON.some((p) => location.pathname.startsWith(p))

  // Modo manutencao: bloqueia todos exceto admin.
  if (settings?.maintenance_enabled && !isAdmin) {
    return <Maintenance settings={settings} />
  }

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar />
      <div className="md:pl-64">
        <main className={`mx-auto w-full max-w-5xl ${hideMobileNav ? '' : 'pb-28 md:pb-10'}`}>
          {!hideMobileNav && (
            <div className="px-5 pt-4">
              <AnnouncementBanner />
            </div>
          )}
          <Outlet />
        </main>
      </div>
      {!hideMobileNav && <BottomNav />}
    </div>
  )
}
