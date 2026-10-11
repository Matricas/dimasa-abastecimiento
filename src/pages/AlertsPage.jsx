import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../hooks/useAlerts'
import { ALERT_TYPES, SEVERITIES, sortAlerts } from '../lib/alerts'
import { formatDateTime, formatNumber } from '../lib/format'
import AlertCard from '../components/AlertCard'
import StateMessage from '../components/StateMessage'

const PAGE_SIZE = 20
const chip = (active) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? 'border-graphite-900 bg-graphite-900 text-white' : 'border-concrete-300 bg-white hover:border-graphite-400'}`

function AlertsPage() {
  const { alerts, loading, recomputing, error, reload, recompute, review, undo } = useAlerts()
  const { user, profile } = useAuth()
  const canReview = ['admin', 'compras'].includes(profile?.role)
  const [type, setType] = useState('todas')
  const [showReviewed, setShowReviewed] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const open = useMemo(() => alerts.filter((a) => !a.reviewed), [alerts])
  const reviewedCount = alerts.length - open.length
  const list = useMemo(
    () => sortAlerts((showReviewed ? alerts : open).filter((a) => type === 'todas' || a.alert_type === type)),
    [alerts, open, showReviewed, type],
  )
  const countBy = (key, value) => open.filter((a) => a[key] === value).length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Fase 5 · Alertas</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [font-stretch:108%]">Alertas</h1>
          <p className="mt-2 max-w-2xl text-sm text-graphite-500">
            Lo que requiere atención hoy: quiebres que vienen, stock que sobra o está parado, y espacio en bodega y patio.
          </p>
          {alerts[0] && <p className="mt-2 font-mono text-xs text-graphite-500">Calculadas el {formatDateTime(alerts[0].computed_at)}</p>}
        </div>
        {canReview && (
          <button type="button" onClick={recompute} disabled={loading || recomputing} className="inline-flex items-center gap-2 self-start rounded-md border border-concrete-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-graphite-900 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto">
            <RefreshCw className={`h-4 w-4 ${recomputing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {recomputing ? 'Recalculando…' : 'Recalcular alertas'}
          </button>
        )}
      </header>

      {loading && alerts.length === 0 && <div role="status" aria-label="Cargando alertas" className="h-96 animate-pulse rounded-lg bg-concrete-200" />}

      {error && (
        <section className="rounded-lg border border-alert-600/30 bg-white">
          <StateMessage variant="error" title="No pudimos cargar las alertas" description="La conexión con la base de datos falló. Si el problema sigue, avisa al administrador." detail={[error.code, error.message].filter(Boolean).join(' · ')} onRetry={reload} />
        </section>
      )}

      {!loading && !error && alerts.length === 0 && (
        <section className="rounded-lg border border-concrete-300 bg-white">
          <StateMessage variant="empty" title="Sin alertas activas" description={canReview ? 'Nada requiere atención con los datos actuales. Recalcula después de cargar datos nuevos.' : 'Nada requiere atención con los datos actuales.'} />
        </section>
      )}

      {!error && alerts.length > 0 && (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {Object.entries(SEVERITIES).map(([key, s]) => (
              <div key={key} className="rounded-lg border border-concrete-300 bg-white p-4">
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500">
                  <s.Icon className="h-4 w-4" aria-hidden="true" /> {s.label}s
                </dt>
                <dd className="mt-1 font-mono text-2xl font-semibold">{formatNumber(countBy('severity', key))}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por tipo">
            {['todas', ...Object.keys(ALERT_TYPES)].map((key) => (
              <button key={key} type="button" aria-pressed={type === key} onClick={() => { setType(key); setVisible(PAGE_SIZE) }} className={chip(type === key)}>
                {key === 'todas' ? 'Todas' : ALERT_TYPES[key].label}{' '}
                <span className={`font-mono text-xs ${type === key ? 'text-signal-400' : 'text-graphite-500'}`}>{key === 'todas' ? open.length : countBy('alert_type', key)}</span>
              </button>
            ))}
            {reviewedCount > 0 && (
              <label className="ml-auto inline-flex items-center gap-2 text-sm text-graphite-700">
                <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} className="h-4 w-4 accent-graphite-900" />
                Mostrar revisadas ({reviewedCount})
              </label>
            )}
          </div>

          {list.length === 0 ? (
            <section className="rounded-lg border border-concrete-300 bg-white">
              <StateMessage variant="empty" title="Nada pendiente en esta categoría" description="Las alertas revisadas se ocultan por 14 días." />
            </section>
          ) : (
            <ul className="space-y-3">
              {list.slice(0, visible).map((alert) => (
                <AlertCard key={alert.id} alert={alert} canReview={canReview} currentUserId={user?.id} onReview={review} onUndo={undo} />
              ))}
            </ul>
          )}
          {visible < list.length && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="rounded-md border border-graphite-900 px-4 py-2 text-sm font-medium transition-colors hover:bg-graphite-900 hover:text-white">
                Mostrar {Math.min(PAGE_SIZE, list.length - visible)} más de {list.length}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AlertsPage
