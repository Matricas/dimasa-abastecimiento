import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ROLE_OPTIONS } from '../lib/roles'
import { formatDateTime } from '../lib/format'

// Una fila por cuenta: en celular se apila, desde md se alinea en columnas.
function UserRow({ user, isSelf, saving, saveError, onSave }) {
  const [role, setRole] = useState(user.role)
  const selectId = useId()
  const changed = role !== user.role
  const pending = user.role === 'pendiente'

  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium text-graphite-900">
          <span className="truncate">{user.full_name || user.email}</span>
          {isSelf && <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-graphite-500">(tú)</span>}
          {pending && (
            <span className="shrink-0 rounded bg-signal-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-graphite-900">
              Por aprobar
            </span>
          )}
        </p>
        {user.full_name && <p className="truncate text-sm text-graphite-500">{user.email}</p>}
      </div>

      <p className="text-xs text-graphite-500">
        <span className="md:hidden">Último ingreso: </span>
        {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Nunca ha ingresado'}
      </p>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(user.user_id, role)
        }}
      >
        <label htmlFor={selectId} className="sr-only">
          Rol de {user.full_name || user.email}
        </label>
        <select
          id={selectId}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={saving}
          className="min-w-0 flex-1 rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!changed || saving}
          className="inline-flex items-center gap-2 rounded-md bg-graphite-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-graphite-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Guardando…' : 'Guardar rol'}
        </button>
        {saveError && (
          <p role="alert" className="w-full text-sm text-alert-600">
            {saveError.message}
          </p>
        )}
      </form>
    </li>
  )
}

export default UserRow
