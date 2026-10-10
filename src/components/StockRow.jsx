import { formatMillions, formatNumber } from '../lib/format'
import StatusBadge from './StatusBadge'
import { CoverageBar, lastSaleLabel, productMeta } from './StockCells'

function StockRow({ row }) {
  return (
    <tr className="align-top transition-colors hover:bg-concrete-50">
      <td className="py-3 pl-5 pr-3">
        <p className="font-mono text-xs text-graphite-500">{row.sku}</p>
        <p className="mt-0.5 font-medium text-graphite-900">{row.name}</p>
        <p className="mt-0.5 text-xs text-graphite-500">{productMeta(row)}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm">
        {formatNumber(row.stock_qty)}
        <span className="block text-xs text-graphite-500">{row.unit}</span>
      </td>
      <td className="px-3 py-3">
        <CoverageBar row={row} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm">{formatMillions(row.stock_value)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm font-semibold">
        {row.excess_value > 0 ? formatMillions(row.excess_value) : <span className="font-normal text-graphite-400">—</span>}
      </td>
      <td className="py-3 pl-3 pr-5">
        <StatusBadge status={row.status} />
        <p className="mt-1 whitespace-nowrap text-xs text-graphite-500">{lastSaleLabel(row.days_since_last_sale)}</p>
      </td>
    </tr>
  )
}

export default StockRow
