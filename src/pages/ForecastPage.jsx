import { useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useForecast } from '../hooks/useForecast'
import { summarizeAccuracy } from '../lib/forecast'
import { formatDate, formatDateTime } from '../lib/format'
import AccuracyPanel from '../components/AccuracyPanel'
import ProductForecastPanel from '../components/ProductForecastPanel'
import ForecastTable from '../components/ForecastTable'
import StateMessage from '../components/StateMessage'

const ABC_ORDER = { A: 0, B: 1, C: 2 }

function ForecastPage() {
  const { rows, loading, recomputing, error, reload, recompute } = useForecast()
  const { profile } = useAuth()
  const canRecompute = ['admin', 'compras'].includes(profile?.role)
  const [selectedId, setSelectedId] = useState(null)
  const panelRef = useRef(null)

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (ABC_ORDER[a.abc_class] ?? 3) - (ABC_ORDER[b.abc_class] ?? 3) || b.forecast_horizon - a.forecast_horizon),
    [rows],
  )
  const accuracy = useMemo(() => summarizeAccuracy(rows), [rows])
  const selected = sorted.find((r) => r.product_id === selectedId) ?? sorted[0]

  const handleSelect = (id) => {
    setSelectedId(id)
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Fase 3 · Proyección</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [font-stretch:108%]">Forecast de demanda</h1>
          <p className="mt-2 max-w-2xl text-sm text-graphite-500">
            Cuánto se va a vender de cada producto, semana a semana: 12 semanas para nacionales y 17 para importados.
          </p>
          {rows[0] && (
            <p className="mt-2 font-mono text-xs text-graphite-500">
              Con ventas al {formatDate(rows[0].origin_date)} · calculado el {formatDateTime(rows[0].computed_at)}
            </p>
          )}
        </div>
        {canRecompute && (
          <button
            type="button"
            onClick={recompute}
            disabled={loading || recomputing}
            className="inline-flex items-center gap-2 self-start rounded-md border border-concrete-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-graphite-900 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${recomputing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {recomputing ? 'Recalculando…' : 'Recalcular forecast'}
          </button>
        )}
      </header>

      {loading && rows.length === 0 && (
        <div role="status" aria-label="Cargando forecast" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-lg bg-concrete-200" />)}
          </div>
          <div className="h-96 animate-pulse rounded-lg bg-concrete-200" />
        </div>
      )}

      {error && (
        <section className="rounded-lg border border-alert-600/30 bg-white">
          <StateMessage
            variant="error"
            title="No pudimos cargar el forecast"
            description="La conexión con la base de datos falló. Si el problema sigue, avisa al administrador."
            detail={[error.code, error.message].filter(Boolean).join(' · ')}
            onRetry={reload}
          />
        </section>
      )}

      {!loading && !error && rows.length === 0 && (
        <section className="rounded-lg border border-concrete-300 bg-white">
          <StateMessage
            variant="empty"
            title="El forecast aún no está calculado"
            description={canRecompute ? 'Presiona "Recalcular forecast" para proyectar la venta con el historial cargado.' : 'Pídele a compras o al administrador que calcule el forecast.'}
          />
        </section>
      )}

      {!error && rows.length > 0 && (
        <>
          <AccuracyPanel accuracy={accuracy} />
          <div ref={panelRef} className="scroll-mt-20">
            {selected && <ProductForecastPanel product={selected} />}
          </div>
          <ForecastTable rows={sorted} selectedId={selected?.product_id} onSelect={handleSelect} />
        </>
      )}
    </div>
  )
}

export default ForecastPage
