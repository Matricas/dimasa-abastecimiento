import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAbcXyz } from '../hooks/useAbcXyz'
import { ABC_INFO } from '../lib/abcXyz'
import { formatDateTime, formatNumber, formatPercent } from '../lib/format'
import MatrixGrid from '../components/MatrixGrid'
import CellDetail from '../components/CellDetail'
import StateMessage from '../components/StateMessage'

function MatrixPage() {
  const { summary, computedAt, loading, recomputing, error, reload, recompute } = useAbcXyz()
  const { profile } = useAuth()
  const canRecompute = ['admin', 'compras'].includes(profile?.role)
  const busy = loading || recomputing
  const [selectedKey, setSelectedKey] = useState('AX')

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Fase 2 · Clasificación</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [font-stretch:108%]">Matriz ABC-XYZ</h1>
          <p className="mt-2 max-w-2xl text-sm text-graphite-500">
            Cada producto se ordena por cuánto deja y por cuán predecible es su venta. Cada celda tiene su regla de compra.
          </p>
          {computedAt && (
            <p className="mt-2 font-mono text-xs text-graphite-500">Calculada el {formatDateTime(computedAt)}</p>
          )}
        </div>
        {canRecompute && (
          <button
            type="button"
            onClick={recompute}
            disabled={busy}
            title="Vuelve a clasificar todos los productos con las ventas más recientes"
            className="inline-flex items-center gap-2 self-start rounded-md border border-concrete-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-graphite-900 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${recomputing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {recomputing ? 'Recalculando…' : 'Recalcular matriz'}
          </button>
        )}
      </header>

      {loading && !summary && (
        <div role="status" aria-label="Cargando matriz" className="space-y-6">
          <div className="h-24 animate-pulse rounded-lg bg-concrete-200" />
          <div className="h-[28rem] animate-pulse rounded-lg bg-concrete-200" />
        </div>
      )}

      {error && (
        <section className="rounded-lg border border-alert-600/30 bg-white">
          <StateMessage
            variant="error"
            title="No pudimos calcular la matriz"
            description="La conexión con la base de datos falló. Si el problema sigue, avisa al administrador."
            detail={[error.code, error.message].filter(Boolean).join(' · ')}
            onRetry={reload}
          />
        </section>
      )}

      {!loading && !error && summary?.productCount === 0 && (
        <section className="rounded-lg border border-concrete-300 bg-white">
          <StateMessage
            variant="empty"
            title="La matriz aún no está calculada"
            description={
              canRecompute
                ? 'Presiona "Recalcular matriz" para clasificar los productos con el margen de los últimos 12 meses y la venta de las últimas 52 semanas.'
                : 'Pídele a compras o al administrador que calcule la matriz.'
            }
          />
        </section>
      )}

      {!error && summary && summary.productCount > 0 && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            {summary.abcTotals.map((t) => (
              <div key={t.abc} className="rounded-lg border border-concrete-300 bg-white p-5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-graphite-500">
                  Clase {t.abc} · {ABC_INFO[t.abc].label}
                </dt>
                <dd className="mt-2 text-sm text-graphite-600">
                  <span className="font-mono text-2xl font-semibold text-graphite-900">{formatNumber(t.count)}</span> productos (
                  {formatPercent(t.productShare)} del catálogo) generan el{' '}
                  <strong className="font-semibold text-graphite-900">{formatPercent(t.marginShare)}</strong> del margen
                </dd>
              </div>
            ))}
          </dl>

          <MatrixGrid cells={summary.cells} selectedKey={selectedKey} onSelect={setSelectedKey} />
          <CellDetail key={selectedKey} cell={summary.cells[selectedKey]} />

          <p className="text-xs leading-relaxed text-graphite-500">
            ABC: margen de los últimos 12 meses (A suma el 80%, B el siguiente 15%, C el resto). XYZ: coeficiente de
            variación de la venta semanal en 52 semanas, incluidas las semanas sin venta. Estacionalidad: diferencia entre el
            mes más alto y el más bajo de los últimos 24 meses (0 = pareja, 1 = muy estacional).
          </p>
        </>
      )}
    </div>
  )
}

export default MatrixPage
