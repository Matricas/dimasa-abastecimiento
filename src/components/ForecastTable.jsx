import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { METHOD_LABELS } from '../lib/forecast'
import { formatNumber, formatPercent } from '../lib/format'

const PAGE_SIZE = 25

const productWape = (row, key) => (row.backtest_actual_qty > 0 ? row[key] / row.backtest_actual_qty : null)

function ForecastTable({ rows, selectedId, onSelect }) {
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => !q || r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <section className="rounded-lg border border-concrete-300 bg-white">
      <header className="space-y-3 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Productos</h2>
          <p className="mt-1 text-sm text-graphite-500">Elige un producto para ver su gráfico. Ordenados por clase y venta proyectada.</p>
        </div>
        <label className="relative block">
          <span className="sr-only">Buscar por SKU o nombre</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE) }}
            placeholder="Buscar por SKU o nombre (ej. CEM-0001, cemento)"
            className="w-full rounded-md border border-concrete-300 bg-white py-2 pl-9 pr-3 text-sm transition-colors hover:border-graphite-400 focus:border-graphite-900 focus:outline-none focus:ring-2 focus:ring-signal-400"
          />
        </label>
      </header>

      <ul className="divide-y divide-concrete-200 border-t border-concrete-300">
        {filtered.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-graphite-500">Ningún producto coincide con “{query}”.</li>
        )}
        {filtered.slice(0, visible).map((row) => {
          const model = productWape(row, 'abs_error_model')
          const lastYear = productWape(row, 'abs_error_last_year')
          const wins = model !== null && lastYear !== null && model < lastYear
          const selected = row.product_id === selectedId
          return (
            <li key={row.product_id}>
              <button
                type="button"
                onClick={() => onSelect(row.product_id)}
                aria-pressed={selected}
                className={`grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors sm:grid-cols-[1fr_8rem_8rem_9rem] ${
                  selected ? 'bg-signal-100 shadow-[inset_3px_0_0_#F2B705]' : 'hover:bg-concrete-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-mono text-xs text-graphite-500">{row.sku} · {row.abc_class}-{row.xyz_class} · {METHOD_LABELS[row.method]}</span>
                  <span className="block truncate font-medium">{row.name}</span>
                </span>
                <span className="text-right font-mono text-sm">
                  {formatNumber(row.forecast_4w)}
                  <span className="block text-xs text-graphite-500">próx. 4 sem.</span>
                </span>
                <span className="hidden text-right font-mono text-sm sm:block">
                  {formatNumber(row.forecast_horizon)}
                  <span className="block text-xs text-graphite-500">próx. {row.horizon_weeks} sem.</span>
                </span>
                <span className="col-span-2 text-xs sm:col-span-1 sm:text-right">
                  {model === null ? (
                    <span className="text-graphite-500">Sin ventas para evaluar</span>
                  ) : (
                    <>
                      <span className="font-mono text-sm text-graphite-900">{formatPercent(model)}</span>{' '}
                      <span className={wins ? 'text-ok-700' : 'text-alert-700'}>{wins ? 'mejor' : 'peor'} que año ant.</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <footer className="flex flex-col items-center gap-3 border-t border-concrete-300 px-5 py-4 sm:flex-row sm:justify-between">
        <p className="text-sm text-graphite-500">Mostrando {Math.min(visible, filtered.length)} de {filtered.length} productos</p>
        {visible < filtered.length && (
          <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="rounded-md border border-graphite-900 px-4 py-2 text-sm font-medium transition-colors hover:bg-graphite-900 hover:text-white">
            Mostrar {Math.min(PAGE_SIZE, filtered.length - visible)} más
          </button>
        )}
      </footer>
    </section>
  )
}

export default ForecastTable
