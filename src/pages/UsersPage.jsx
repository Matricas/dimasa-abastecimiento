import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { ROLE_OPTIONS } from '../lib/roles'
import { formatNumber } from '../lib/format'
import StateMessage from '../components/StateMessage'
import UserRow from '../components/UserRow'

function UsersPage() {
  const { user } = useAuth()
  const { users, loading, error, reload, changeRole, savingId, saveError } = useUsers()
  const pendingCount = users?.filter((u) => u.role === 'pendiente').length ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Administración</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [font-stretch:108%]">Usuarios y roles</h1>
          <p className="mt-2 max-w-2xl text-sm text-graphite-500">
            Las cuentas se crean o se invitan desde el panel de Supabase (Authentication → Users). Aquí les asignas un rol
            para que puedan ver los datos.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-md border border-concrete-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-graphite-900 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar lista
        </button>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_OPTIONS.map((r) => (
          <div key={r.value} className="rounded-lg border border-concrete-300 bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-graphite-500">{r.label}</dt>
            <dd className="mt-1 text-xs text-graphite-500">{r.hint}</dd>
          </div>
        ))}
      </dl>

      {loading && !users && (
        <div role="status" aria-label="Cargando usuarios" className="h-64 animate-pulse rounded-lg bg-concrete-200" />
      )}

      {error && (
        <section className="rounded-lg border border-alert-600/30 bg-white">
          <StateMessage
            variant="error"
            title="No pudimos cargar los usuarios"
            description="La conexión con la base de datos falló o tu sesión ya no es de administrador."
            detail={[error.code, error.message].filter(Boolean).join(' · ')}
            onRetry={reload}
          />
        </section>
      )}

      {!error && users?.length === 0 && (
        <section className="rounded-lg border border-concrete-300 bg-white">
          <StateMessage
            variant="empty"
            title="Todavía no hay cuentas"
            description="Invita a compras y a gerencia desde el panel de Supabase; aparecerán aquí como «Sin acceso»."
          />
        </section>
      )}

      {!error && users?.length > 0 && (
        <section className="rounded-lg border border-concrete-300 bg-white" aria-labelledby="users-title">
          <h2 id="users-title" className="border-b border-concrete-200 px-5 py-3 text-sm font-semibold">
            {formatNumber(users.length)} cuentas
            {pendingCount > 0 && <span className="text-graphite-500"> · {formatNumber(pendingCount)} por aprobar</span>}
          </h2>
          <ul className="divide-y divide-concrete-200">
            {users.map((u) => (
              <UserRow
                key={`${u.user_id}-${u.role}`}
                user={u}
                isSelf={u.user_id === user?.id}
                saving={savingId === u.user_id}
                saveError={saveError?.userId === u.user_id ? saveError.error : null}
                onSave={changeRole}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default UsersPage
