import { formatNumber } from '../lib/format'
import { CHART_COLORS as COLORS, addDays, parseDate } from '../lib/forecast'

const dayMonth = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function Row({ color, dashed, value, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-0.5 w-4" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 6px)` : color }} />
      <span className="font-mono text-sm font-semibold text-graphite-900">{value}</span>
      <span className="text-xs text-graphite-500">{label}</span>
    </div>
  )
}

function ChartTooltip({ point, unit, left, chartWidth }) {
  const flip = left > chartWidth * 0.6
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-[11rem] rounded-md border border-concrete-300 bg-white px-3 py-2 shadow-lg"
      style={flip ? { right: chartWidth - left + 12 } : { left: left + 12 }}
    >
      <p className="text-xs text-graphite-500">
        Semana {dayMonth.format(parseDate(point.weekStart))} – {dayMonth.format(parseDate(addDays(point.weekStart, 6)))}
      </p>
      <div className="mt-1 space-y-1">
        {point.real !== undefined && <Row color={COLORS.real} value={`${formatNumber(point.real)} ${unit}`} label="Real" />}
        {point.forecast !== undefined && (
          <>
            <Row color={COLORS.forecast} dashed value={`${formatNumber(point.forecast)} ${unit}`} label="Proyección" />
            <p className="pl-6 text-xs text-graphite-500">
              Rango {formatNumber(point.low)} – {formatNumber(point.high)}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ChartTooltip
