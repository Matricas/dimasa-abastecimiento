import { NavLink } from 'react-router-dom'
import { BellRing, ClipboardList, Database, Gauge, Grid3x3, LogOut, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../services/authService'
import BrandMark from './BrandMark'

const NAV_ITEMS = [
  { to: '/diagnostico', label: 'Diagnóstico', Icon: Gauge },
  { to: '/matriz', label: 'Matriz ABC-XYZ', Icon: Grid3x3 },
  { to: '/forecast', label: 'Forecast de demanda', Icon: TrendingUp },
  { to: '/compras', label: 'Propuesta de compra', Icon: ClipboardList },
  { label: 'Alertas', Icon: BellRing },
  { label: 'Datos', Icon: Database },
]

const ROLE_LABELS = { admin: 'Administrador', compras: 'Compras', gerencia: 'Gerencia' }

const itemClass = 'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium'

function Sidebar({ onNavigate }) {
  const { user, profile } = useAuth()

  return (
    <div className="flex h-full flex-col bg-graphite-900 text-concrete-200">
      <div className="px-5 py-6">
        <BrandMark inverted />
      </div>

      <nav aria-label="Módulos" className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, Icon }) =>
          to ? (
            <NavLink
              key={label}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `${itemClass} transition-colors ${
                  isActive ? 'bg-graphite-700 text-white shadow-[inset_3px_0_0_#F2B705]' : 'hover:bg-graphite-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ) : (
            <span key={label} aria-disabled="true" className={`${itemClass} cursor-not-allowed text-graphite-400`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              <span className="ml-auto rounded bg-graphite-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                Pronto
              </span>
            </span>
          ),
        )}
      </nav>

      <div className="border-t border-graphite-700 px-5 py-4">
        <p className="truncate text-sm text-white" title={user?.email}>
          {profile?.full_name || user?.email}
        </p>
        <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-signal-400">
          {ROLE_LABELS[profile?.role] ?? '—'}
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-4 inline-flex items-center gap-2 rounded-md text-sm text-concrete-300 transition-colors hover:text-white"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default Sidebar
