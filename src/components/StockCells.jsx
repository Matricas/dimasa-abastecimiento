import { formatNumber } from '../lib/format'

export function CoverageBar({ row }) {
  if (row.coverage_days === null) return <span className="text-sm text-graphite-500">Sin ventas en 90 días</span>
  const ratio = Math.min(row.coverage_days / row.target_cover_days, 2) / 2
  const barClass =
    row.coverage_days > row.target_cover_days
      ? 'bg-signal-400'
      : row.coverage_days < row.lead_time_days
        ? 'bg-steel-600'
        : 'bg-ok-600'
  return (
    <div className="w-full max-w-[8rem]">
      <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
        <span className="text-sm text-graphite-900">{formatNumber(row.coverage_days)} d</span>
        <span className="text-graphite-500">obj. {row.target_cover_days}</span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-concrete-200" title={`Objetivo: ${row.target_cover_days} días`}>
        <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${ratio * 100}%` }} />
        <span className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-graphite-900" aria-hidden="true" />
      </div>
    </div>
  )
}

export function lastSaleLabel(days) {
  if (days === null) return 'Sin ventas registradas'
  if (days === 0) return 'Última venta hoy'
  return `Última venta hace ${formatNumber(days)} d`
}

export function productMeta(row) {
  const zone = row.storage_zone === 'patio' ? 'Patio' : 'Bodega'
  const origin = row.origin === 'importado' ? 'Importado' : 'Nacional'
  return `${row.category} · ${zone} · ${origin}, reposición ${row.lead_time_days} d`
}
