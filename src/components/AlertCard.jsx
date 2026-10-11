import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Loader2, Undo2 } from 'lucide-react'
import { ALERT_TYPES, SEVERITIES } from '../lib/alerts'
import { formatDateTime, formatShortCLP } from '../lib/format'

function AlertCard({ alert, canReview, currentUserId, onReview, onUndo }) {
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const severity = SEVERITIES[alert.severity]
  const type = ALERT_TYPES[alert.alert_type]

  const run = async (action) => {
    setSaving(true)
    setError('')
    try {
      await action()
      setNoting(false)
      setNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={`relative overflow-hidden rounded-lg border border-concrete-300 bg-white pl-5 pr-4 py-4 sm:pr-5 ${alert.reviewed ? 'opacity-70' : ''}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${severity.bar}`} aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ring-1 ring-inset ${severity.badge}`}>
              <severity.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {severity.label}
            </span>
            <span className="inline-flex items-center gap-1 text-graphite-600">
              <type.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {type.label}
            </span>
            {alert.sku && <span className="font-mono text-graphite-500">{alert.sku}</span>}
          </div>
          <p className="mt-2 font-semibold text-graphite-900">{alert.title}</p>
          <p className="mt-1 text-sm text-graphite-600">{alert.detail}</p>
          <p className="mt-2 text-sm font-medium text-graphite-800">→ {alert.action}</p>
        </div>
        {alert.value_clp > 0 && (
          <p className="shrink-0 font-mono text-lg font-semibold sm:text-right">
            {formatShortCLP(alert.value_clp)}
            <span className="block font-sans text-xs font-normal text-graphite-500">
              {alert.alert_type === 'quiebre_inminente' ? 'venta en riesgo' : 'a costo'}
            </span>
          </p>
        )}
      </div>

      {alert.reviewed && (
        <p className="mt-3 rounded-md bg-concrete-100 px-3 py-2 text-sm text-graphite-700">
          Revisada el {formatDateTime(alert.reviewed_at)}{alert.review_note ? `: ${alert.review_note}` : ''}. Se oculta por 14 días.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link to={type.link.to} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-steel-700 hover:bg-steel-50">
          {type.link.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {canReview && !alert.reviewed && !noting && (
          <button type="button" onClick={() => setNoting(true)} className="inline-flex items-center gap-1.5 rounded-md border border-concrete-300 px-3 py-1.5 text-sm font-medium hover:border-graphite-900">
            <Check className="h-4 w-4" aria-hidden="true" /> Marcar como revisada
          </button>
        )}
        {canReview && alert.reviewed && alert.reviewed_by === currentUserId && (
          <button type="button" disabled={saving} onClick={() => run(() => onUndo(alert.review_id))} className="inline-flex items-center gap-1.5 rounded-md border border-concrete-300 px-3 py-1.5 text-sm font-medium hover:border-graphite-900 disabled:opacity-60">
            <Undo2 className="h-4 w-4" aria-hidden="true" /> Deshacer revisión
          </button>
        )}
      </div>

      {noting && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => onReview(alert.alert_key, note.trim())) }} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Nota de la revisión (opcional)</span>
            <input type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional, ej.: ya se pidió por teléfono" className="w-full rounded-md border border-concrete-300 px-3 py-2 text-sm focus:border-graphite-900 focus:outline-none focus:ring-2 focus:ring-signal-400" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-graphite-900 px-4 py-2 text-sm font-medium text-white hover:bg-graphite-700 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Guardar
            </button>
            <button type="button" onClick={() => setNoting(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-concrete-200">Cancelar</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-alert-700">{error}</p>}
    </li>
  )
}

export default AlertCard
