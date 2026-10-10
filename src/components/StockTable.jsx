import { useMemo, useState } from 'react'
import StockFilters from './StockFilters'
import StockRow from './StockRow'
import StockCard from './StockCard'
import StateMessage from './StateMessage'

const PAGE_SIZE = 25
const INITIAL_FILTERS = { status: 'todos', zone: 'todas', query: '', sort: 'excess_value' }
const COLUMNS = [
  ['Producto', 'left'],
  ['Stock', 'right'],
  ['Cobertura', 'left'],
  ['Capital', 'right'],
  ['Exceso', 'right'],
  ['Estado', 'left'],
]

function StockTable({ rows }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const counts = useMemo(
    () => rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), { todos: rows.length }),
    [rows],
  )

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    return rows
      .filter((row) => filters.status === 'todos' || row.status === filters.status)
      .filter((row) => filters.zone === 'todas' || row.storage_zone === filters.zone)
      .filter((row) => !query || row.sku.toLowerCase().includes(query) || row.name.toLowerCase().includes(query))
      .sort((a, b) => (b[filters.sort] ?? Infinity) - (a[filters.sort] ?? Infinity) || 0)
  }, [rows, filters])

  const handleFilters = (next) => {
    setFilters(next)
    setVisible(PAGE_SIZE)
  }

  return (
    <section className="rounded-lg border border-concrete-300 bg-white">
      <header className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Productos</h2>
          <p className="mt-1 text-sm text-graphite-500">
            Ordenados por capital en exceso. La cobertura se calcula con la venta diaria de los últimos 90 días.
          </p>
        </div>
        <StockFilters filters={filters} counts={counts} onChange={handleFilters} />
      </header>

      {filtered.length === 0 ? (
        <StateMessage
          variant="empty"
          title="Ningún producto coincide con estos filtros"
          description="Prueba con otro estado, zona o término de búsqueda."
          onRetry={() => handleFilters(INITIAL_FILTERS)}
          retryLabel="Limpiar filtros"
        />
      ) : (
        <>
          <ul className="divide-y divide-concrete-200 border-t border-concrete-300 md:hidden">
            {filtered.slice(0, visible).map((row) => (
              <StockCard key={row.product_id} row={row} />
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-t border-concrete-300 md:block">
            <table className="min-w-full divide-y divide-concrete-200 text-left">
              <thead className="bg-concrete-50">
                <tr>
                  {COLUMNS.map(([label, align], i) => (
                    <th
                      key={label}
                      scope="col"
                      className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 ${
                        align === 'right' ? 'text-right' : ''
                      } ${i === 0 ? 'pl-5' : ''} ${i === COLUMNS.length - 1 ? 'pr-5' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-concrete-200">
                {filtered.slice(0, visible).map((row) => (
                  <StockRow key={row.product_id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col items-center gap-3 border-t border-concrete-300 px-5 py-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-graphite-500">
              Mostrando {Math.min(visible, filtered.length)} de {filtered.length} productos
            </p>
            {visible < filtered.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-md border border-graphite-900 px-4 py-2 text-sm font-medium transition-colors hover:bg-graphite-900 hover:text-white"
              >
                Mostrar {Math.min(PAGE_SIZE, filtered.length - visible)} más
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  )
}

export default StockTable
