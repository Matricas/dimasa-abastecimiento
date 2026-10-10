import { formatMillions, formatNumber } from '../lib/format'
import StatusBadge from './StatusBadge'
import { CoverageBar, lastSaleLabel, productMeta } from './StockCells'

function Figure({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-graphite-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{children}</dd>
    </div>
  )
}

function StockCard({ row }) {
  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs text-graphite-500">{row.sku}</p>
        <StatusBadge status={row.status} />
      </div>
      <p className="mt-1 font-medium text-graphite-900">{row.name}</p>
      <p className="mt-0.5 text-xs text-graphite-500">{productMeta(row)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <Figure label="Stock">
          {formatNumber(row.stock_qty)} <span className="text-xs text-graphite-500">{row.unit}</span>
        </Figure>
        <Figure label="Cobertura">
          <CoverageBar row={row} />
        </Figure>
        <Figure label="Capital">{formatMillions(row.stock_value)}</Figure>
        <Figure label="Exceso">
          <span className="font-semibold">{row.excess_value > 0 ? formatMillions(row.excess_value) : '—'}</span>
        </Figure>
      </dl>
      <p className="mt-3 text-xs text-graphite-500">{lastSaleLabel(row.days_since_last_sale)}</p>
    </li>
  )
}

export default StockCard
