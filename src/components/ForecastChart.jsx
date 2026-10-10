import { useMemo, useState } from 'react'
import { useElementWidth } from '../hooks/useElementWidth'
import { formatNumber } from '../lib/format'
import { CHART_COLORS, parseDate } from '../lib/forecast'
import ChartTooltip from './ChartTooltip'

const { real: REAL_COLOR, forecast: FORECAST_COLOR } = CHART_COLORS

const HEIGHT = 280
const PAD = { top: 16, right: 16, bottom: 28, left: 52 }
const monthLabel = new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' })

function niceMax(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude / 2) * 2 * magnitude
}

function ForecastChart({ history, forecast, unit }) {
  const [ref, width] = useElementWidth()
  const [hover, setHover] = useState(null)

  const points = useMemo(
    () => [
      ...history.map((w) => ({ weekStart: w.weekStart, real: w.qty })),
      ...forecast.map((f) => ({ weekStart: f.week_start, forecast: f.forecast_qty, low: f.low_qty, high: f.high_qty })),
    ],
    [history, forecast],
  )
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const yMax = niceMax(Math.max(...points.map((p) => Math.max(p.real ?? 0, p.high ?? 0))))
  const x = (i) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : 0)
  const y = (v) => PAD.top + plotH - (v / yMax) * plotH
  const path = (list) => list.map(([i, v], n) => `${n ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')

  const realPts = points.flatMap((p, i) => (p.real !== undefined ? [[i, p.real]] : []))
  const lastReal = realPts[realPts.length - 1]
  const fcPts = points.flatMap((p, i) => (p.forecast !== undefined ? [[i, p.forecast]] : []))
  const fcLine = lastReal ? [lastReal, ...fcPts] : fcPts
  const band = fcPts.length
    ? `${path(fcPts.map(([i]) => [i, points[i].high]))}L${fcPts
        .slice()
        .reverse()
        .map(([i]) => `${x(i).toFixed(1)},${y(points[i].low).toFixed(1)}`)
        .join('L')}Z`
    : ''
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax)
  // primera semana de cada mes; en pantallas angostas, un mes por medio
  const monthStarts = points.flatMap((p, i) =>
    i > 0 && parseDate(p.weekStart).getUTCMonth() !== parseDate(points[i - 1].weekStart).getUTCMonth() ? [i] : [],
  )
  const monthTicks = plotW < 520 ? monthStarts.filter((_, n) => n % 2 === 0) : monthStarts

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const i = Math.round(((event.clientX - rect.left - PAD.left) / plotW) * (points.length - 1))
    setHover(i >= 0 && i < points.length ? i : null)
  }

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Venta semanal real de las últimas 52 semanas y proyección" onPointerMove={handleMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#E5E7E1" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-graphite-500 font-mono text-[11px]">{formatNumber(t)}</text>
            </g>
          ))}
          {monthTicks.map((i) => (
            <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-graphite-500 text-[11px]">{monthLabel.format(parseDate(points[i].weekStart))}</text>
          ))}
          {lastReal && (
            <g>
              <line x1={x(lastReal[0])} x2={x(lastReal[0])} y1={PAD.top} y2={PAD.top + plotH} stroke="#7A8285" strokeDasharray="2 3" />
              <text x={x(lastReal[0]) + 6} y={PAD.top + 10} className="fill-graphite-600 text-[11px]">Hoy</text>
            </g>
          )}
          <path d={band} fill={FORECAST_COLOR} fillOpacity="0.16" />
          <path d={path(realPts)} fill="none" stroke={REAL_COLOR} strokeWidth="2" strokeLinejoin="round" />
          <path d={path(fcLine)} fill="none" stroke={FORECAST_COLOR} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#1E2427" strokeOpacity="0.4" />}
        </svg>
      )}
      {hover !== null && <ChartTooltip point={points[hover]} unit={unit} left={x(hover)} chartWidth={width} />}
    </div>
  )
}

export default ForecastChart
