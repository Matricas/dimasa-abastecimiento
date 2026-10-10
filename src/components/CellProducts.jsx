import { formatDecimal, formatNumber, formatShortCLP } from '../lib/format'
import { monthName } from '../lib/abcXyz'
import StatusBadge from './StatusBadge'

function Seasonality({ row }) {
  if (row.seasonality_weight === null) return <span className="text-sm text-graphite-500">Sin datos</span>
  return (
    <div className="w-28">
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="text-sm text-graphite-900">{formatDecimal(row.seasonality_weight)}</span>
        <span className="text-graphite-500">peak {monthName(row.peak_month).slice(0, 3)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-concrete-200" title={`Mes peak: ${monthName(row.peak_month)}`}>
        <div className="h-1.5 rounded-full bg-steel-600" style={{ width: `${row.seasonality_weight * 100}%` }} />
      </div>
    </div>
  )
}

const variation = (row) =>
  row.history_weeks < 52 ? `${formatDecimal(row.weekly_cv)} · ${row.history_weeks} sem.` : formatDecimal(row.weekly_cv)

const th = 'whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-graphite-500'

function CellProducts({ products }) {
  return (
    <>
      <ul className="divide-y divide-concrete-200 border-t border-concrete-300 md:hidden">
        {products.map((row) => (
          <li key={row.product_id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-xs text-graphite-500">{row.sku}</p>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-1 font-medium">{row.name}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-graphite-500">Margen 12 m</dt>
                <dd className="mt-1 font-mono">{formatShortCLP(row.margin_12m)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-graphite-500">Venta semanal</dt>
                <dd className="mt-1 font-mono">{formatNumber(row.weekly_mean)} <span className="text-xs text-graphite-500">{row.unit}</span></dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-graphite-500">Variación</dt>
                <dd className="mt-1 font-mono">{variation(row)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-graphite-500">Estacionalidad</dt>
                <dd className="mt-1"><Seasonality row={row} /></dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto border-t border-concrete-300 md:block">
        <table className="min-w-full divide-y divide-concrete-200 text-left">
          <thead className="bg-concrete-50">
            <tr>
              <th scope="col" className={`${th} pl-5`}>Producto</th>
              <th scope="col" className={`${th} text-right`}>Margen 12 m</th>
              <th scope="col" className={`${th} text-right`}>Venta semanal</th>
              <th scope="col" className={`${th} text-right`}>Variación</th>
              <th scope="col" className={th}>Estacionalidad</th>
              <th scope="col" className={`${th} text-right`}>Stock</th>
              <th scope="col" className={`${th} pr-5`}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-200">
            {products.map((row) => (
              <tr key={row.product_id} className="align-top transition-colors hover:bg-concrete-50">
                <td className="min-w-[16rem] py-3 pl-5 pr-3">
                  <p className="font-mono text-xs text-graphite-500">{row.sku}</p>
                  <p className="mt-0.5 font-medium">{row.name}</p>
                  <p className="mt-0.5 text-xs text-graphite-500">{row.category}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm">{formatShortCLP(row.margin_12m)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm">
                  {formatNumber(row.weekly_mean)}
                  <span className="block text-xs text-graphite-500">{row.unit}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm">{variation(row)}</td>
                <td className="px-3 py-3"><Seasonality row={row} /></td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm">{formatShortCLP(row.stock_value)}</td>
                <td className="py-3 pl-3 pr-5"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default CellProducts
