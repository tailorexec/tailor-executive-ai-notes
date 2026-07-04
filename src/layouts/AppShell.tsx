import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, Phone, Settings as SettingsIcon, Sparkles, ShieldCheck, Mic } from 'lucide-react'
import { AnaIcon } from '../components/AnaIcon'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from '../components/Logo'
import { Avatar } from '../components/ui'
import { AnnouncementBanner } from '../components/AnnouncementBanner'
import { useAppSettings } from '../app/SettingsProvider'
import { Maintenance } from '../pages/Maintenance'
import { HelpAssistant } from '../pages/HelpAssistant'
import { useT } from '../lib/i18n'

const HIDE_MOBILE_NAV_ON = ['/nota/', '/capturar', '/discador']

interface Item {
  to: string
  icon: React.ReactNode
  labelKey: string
  adminOnly?: boolean
}

const ITEMS: Item[] = [
  { to: '/', icon: <Home size={20} />, labelKey: 'nav.notes' },
  { to: '/discador', icon: <Phone size={20} />, labelKey: 'nav.dialer' },
  { to: '/admin', icon: <ShieldCheck size={20} />, labelKey: 'nav.admin', adminOnly: true },
  { to: '/config', icon: <SettingsIcon size={20} />, labelKey: 'nav.config' },
]

/* ---------- Desktop sidebar (SaaS layout) ---------- */
function Sidebar() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-surface-border bg-surface-card z-40">
      <div className="px-4 pt-7 pb-6 flex justify-center">
        <Logo part="ana" heightClass="h-12" />
      </div>

      <button
        onClick={() => navigate('/capturar')}
        className="btn-primary mx-4 mb-6 py-3 rounded-2xl shadow-float"
      >
        <Sparkles size={18} />
        {t('sidebar.smartRec')}
      </button>

      <p className="px-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">{t('sidebar.menu')}</p>
      <nav className="flex-1 px-3 space-y-1">
        {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-content-secondary hover:bg-surface-elevated hover:text-content-primary'
              }`
            }
          >
            {i.icon}
            {t(i.labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Card ANA: assistente de ajuda */}
      <div className="px-3 mb-3">
        <button
          onClick={() => setHelpOpen(true)}
          className="w-full text-left rounded-2xl border border-accent/25 bg-accent/5 hover:bg-accent/10 hover:border-accent/40 transition-colors px-3.5 py-3"
        >
          <span className="flex items-center gap-2 mb-1">
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-brand-500 text-white shrink-0">
              <AnaIcon size={15} />
            </span>
            <span className="text-sm font-semibold">{t('sidebar.talkAna')}</span>
          </span>
          <span className="block text-xs text-content-muted leading-snug">
            {t('sidebar.anaSub')}
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
          isActive ? 'text-accent' : 'text-content-muted hover:text-content-secondary'
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
  const t = useT()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <div className="relative flex items-center bg-surface-card/95 backdrop-blur border border-surface-border rounded-3xl shadow-float h-16 px-2">
          <NavItem to="/" icon={<Home size={20} />} label={t('nav.notes')} />
          <NavItem to="/discador" icon={<Phone size={20} />} label={t('nav.dialer')} />

          <div className="flex-1 flex justify-center">
            <button
              onClick={() => navigate('/capturar')}
              aria-label="Gravar áudio"
              className="grid place-items-center h-14 w-14 -mt-8 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-float ring-4 ring-surface-card transition-colors"
            >
              <Mic size={24} />
            </button>
          </div>

          {isAdmin ? (
            <NavItem to="/admin" icon={<ShieldCheck size={20} />} label={t('nav.admin')} />
          ) : (
            <div className="flex-1" />
          )}
          <NavItem to="/config" icon={<SettingsIcon size={20} />} label={t('nav.config')} />
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
        <main className={`mx-auto w-full max-w-6xl ${hideMobileNav ? '' : 'pb-28 md:pb-10'}`}>
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
