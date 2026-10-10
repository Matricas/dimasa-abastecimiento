import { Search } from 'lucide-react'
import { STATUS } from '../lib/diagnostics'

const STATUS_FILTERS = ['sobrestock', 'sin_movimiento', 'riesgo_quiebre', 'quiebre', 'sano']

const SORT_OPTIONS = {
  excess_value: 'Mayor exceso',
  stock_value: 'Mayor capital en stock',
  coverage_days: 'Mayor cobertura',
  days_since_last_sale: 'Más días sin venta',
}

const controlClass =
  'rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm text-graphite-900 transition-colors hover:border-graphite-400 focus:border-graphite-900 focus:outline-none focus:ring-2 focus:ring-signal-400'

function StockFilters({ filters, counts, onChange }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value })
  const chip = (value, label, count) => {
    const active = filters.status === value
    return (
      <button
        key={value}
        type="button"
        aria-pressed={active}
        onClick={() => set('status')(value)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          active
            ? 'border-graphite-900 bg-graphite-900 text-white'
            : 'border-concrete-300 bg-white text-graphite-700 hover:border-graphite-400'
        }`}
      >
        {label}
        <span className={`font-mono text-xs ${active ? 'text-signal-400' : 'text-graphite-500'}`}>{count}</span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chip('todos', 'Todos', counts.todos)}
        {STATUS_FILTERS.map((s) => chip(s, STATUS[s].label, counts[s] ?? 0))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar por SKU o nombre</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set('query')(e.target.value)}
            placeholder="Buscar por SKU o nombre (ej. CEM-0001, zinc)"
            className={`${controlClass} w-full pl-9`}
          />
        </label>
        <label>
          <span className="sr-only">Zona</span>
          <select value={filters.zone} onChange={(e) => set('zone')(e.target.value)} className={`${controlClass} w-full sm:w-auto`}>
            <option value="todas">Bodega y patio</option>
            <option value="bodega">Solo bodega techada</option>
            <option value="patio">Solo patio</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Ordenar por</span>
          <select value={filters.sort} onChange={(e) => set('sort')(e.target.value)} className={`${controlClass} w-full sm:w-auto`}>
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

export default StockFilters
