import { CELL_M2 } from '../lib/diagnostics'
import { formatNumber, formatPercent } from '../lib/format'

// Columnas por zona con 10 filas fijas: 4.000 m² = 8×10 y 10.000 m² = 20×10 cuadros de 50 m²
const ROWS = 10

const SEGMENTS = [
  { key: 'neededM2', label: 'Stock necesario', className: 'bg-graphite-700' },
  { key: 'excessM2', label: 'Exceso de cobertura', className: 'bg-signal-400' },
  { key: 'idleM2', label: 'Sin movimiento 90+ días', className: 'bg-idle-hatch' },
]

function buildCells(zone) {
  const total = Math.round(zone.capacity / CELL_M2)
  const cells = []
  for (const segment of SEGMENTS) {
    const count = Math.round(zone[segment.key] / CELL_M2)
    for (let i = 0; i < count && cells.length < total; i++) cells.push(segment.className)
  }
  while (cells.length < total) cells.push('bg-concrete-50 ring-1 ring-inset ring-concrete-300')
  return cells
}

function ZoneGrid({ zone }) {
  const cells = buildCells(zone)
  const columns = Math.round(cells.length / ROWS)
  const ratio = zone.occupied / zone.capacity
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2">
        <span className="block truncate text-sm font-semibold">{zone.name}</span>
        <span className="mt-0.5 block font-mono text-[11px] text-graphite-500 sm:text-xs">
          {formatNumber(zone.occupied)} / {formatNumber(zone.capacity)} m² ·{' '}
          <span className={ratio > 0.85 ? 'font-semibold text-alert-700' : ''}>{formatPercent(ratio)}</span>
        </span>
      </figcaption>
      <div
        className="grid gap-px rounded-sm border-2 border-graphite-900 bg-concrete-300 p-px"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${zone.name}: ${formatNumber(zone.occupied)} de ${formatNumber(zone.capacity)} m² ocupados; ${formatNumber(zone.excessM2 + zone.idleM2)} m² en exceso o sin movimiento`}
      >
        {cells.map((className, i) => (
          <span key={i} className={`aspect-square ${className}`} />
        ))}
      </div>
    </figure>
  )
}

function WarehousePlan({ zones }) {
  const wasted = zones.reduce((t, z) => t + z.excessM2 + z.idleM2, 0)
  const occupied = zones.reduce((t, z) => t + z.occupied, 0)
  return (
    <section className="rounded-lg border border-concrete-300 bg-white p-5 sm:p-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Plano de ocupación</h2>
          <p className="mt-1 text-sm text-graphite-500">
            De {formatNumber(occupied)} m² ocupados,{' '}
            <strong className="font-semibold text-graphite-900">{formatNumber(wasted)} m²</strong> son exceso o stock sin
            movimiento.
          </p>
        </div>
        <p className="font-mono text-xs text-graphite-500">1 cuadro = {CELL_M2} m²</p>
      </header>

      <div className="mt-5 grid gap-3 sm:gap-5" style={{ gridTemplateColumns: zones.map((z) => `${z.capacity}fr`).join(' ') }}>
        {zones.map((zone) => (
          <ZoneGrid key={zone.code} zone={zone} />
        ))}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-graphite-600">
        {SEGMENTS.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-sm ${segment.className}`} aria-hidden="true" />
            {segment.label}
            <span className="font-mono text-xs text-graphite-500">
              {formatNumber(zones.reduce((t, z) => t + z[segment.key], 0))} m²
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-concrete-50 ring-1 ring-inset ring-concrete-300" aria-hidden="true" />
          Libre
        </li>
      </ul>
    </section>
  )
}

export default WarehousePlan
