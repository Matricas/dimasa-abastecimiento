import { RefreshCw } from 'lucide-react'
import { useInventoryDiagnostic } from '../hooks/useInventoryDiagnostic'
import { formatDate, formatMillions, formatNumber, formatPercent } from '../lib/format'
import KpiTile from '../components/KpiTile'
import WarehousePlan from '../components/WarehousePlan'
import CategoryExcess from '../components/CategoryExcess'
import StockTable from '../components/StockTable'
import StateMessage from '../components/StateMessage'
import DiagnosticSkeleton from '../components/DiagnosticSkeleton'

function DiagnosticPage() {
  const { rows, summary, loading, error, reload } = useInventoryDiagnostic()

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Fase 1 · Inventario</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [font-stretch:108%]">Diagnóstico de inventario</h1>
          {summary?.refDate && (
            <p className="mt-2 text-sm text-graphite-500">
              Foto de stock al {formatDate(summary.refDate)} · {formatNumber(summary.productCount)} productos activos
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-md border border-concrete-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-graphite-900 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar datos
        </button>
      </header>

      {loading && !summary && <DiagnosticSkeleton />}

      {error && (
        <section className="rounded-lg border border-alert-600/30 bg-white">
          <StateMessage
            variant="error"
            title="No pudimos cargar el diagnóstico"
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
            title="Aún no hay una foto de stock cargada"
            description="Cuando se carguen las ventas y el stock exportados desde Random ERP, aquí verás el capital parado y la ocupación de bodega y patio."
          />
        </section>
      )}

      {!error && summary && rows.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Capital en stock"
              value={formatMillions(summary.stockValue)}
              detail={`${formatNumber(summary.productCount)} productos, valorizados a costo`}
            />
            <KpiTile
              tone="highlight"
              label="Capital en exceso"
              value={formatMillions(summary.excessValue)}
              detail={`${formatPercent(summary.excessShare)} del stock supera su cobertura objetivo. Es la plata que se puede liberar.`}
            />
            <KpiTile
              label="Sin movimiento 90+ días"
              value={formatMillions(summary.idleValue)}
              detail={`${formatNumber(summary.idleCount)} productos sin ventas en los últimos 3 meses`}
            />
            <KpiTile
              tone={summary.stockoutCount > 0 ? 'alert' : 'default'}
              label="Disponibilidad en riesgo"
              value={`${formatNumber(summary.stockoutCount + summary.atRiskCount)} SKU`}
              detail={`${formatNumber(summary.stockoutCount)} sin stock y ${formatNumber(summary.atRiskCount)} con menos días de stock que su plazo de reposición`}
            />
          </div>
          <p className="text-xs leading-relaxed text-graphite-500">
            Cobertura objetivo: 60 días para proveedores nacionales y 120 para importados. El exceso es el valor a costo del
            stock que supera esa cobertura al ritmo de venta de los últimos 90 días.
          </p>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <WarehousePlan zones={summary.zones} />
            <CategoryExcess categories={summary.categories} />
          </div>

          <StockTable rows={rows} />
        </>
      )}
    </div>
  )
}

export default DiagnosticPage
