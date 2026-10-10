import { useProductForecast } from '../hooks/useProductForecast'
import { CHART_COLORS, METHOD_HINTS, METHOD_LABELS } from '../lib/forecast'
import { formatNumber } from '../lib/format'
import ForecastChart from './ForecastChart'
import ForecastWeekTable from './ForecastWeekTable'
import StateMessage from './StateMessage'

function LegendItem({ color, dashed, label }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="20" height="4" aria-hidden="true">
        <line x1="0" x2="20" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '6 4' : undefined} />
      </svg>
      {label}
    </li>
  )
}

function ProductForecastPanel({ product }) {
  const { history, forecast, loading, error } = useProductForecast(product.product_id, product.origin_date)

  return (
    <section className="rounded-lg border border-concrete-300 bg-white p-5 sm:p-6" aria-live="polite">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs text-graphite-500">
            {product.sku} · {product.abc_class ?? '—'}-{product.xyz_class ?? '—'}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{product.name}</h2>
          <p className="mt-1 text-sm text-graphite-500">
            {METHOD_LABELS[product.method]}: {METHOD_HINTS[product.method].toLowerCase()}.
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-right">
          <dt className="text-xs uppercase tracking-wider text-graphite-500">Próx. 4 semanas</dt>
          <dt className="text-xs uppercase tracking-wider text-graphite-500">Próx. {product.horizon_weeks} semanas</dt>
          <dd className="font-mono text-lg font-semibold">{formatNumber(product.forecast_4w)}</dd>
          <dd className="font-mono text-lg font-semibold">{formatNumber(product.forecast_horizon)}</dd>
        </dl>
      </header>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-graphite-600">
        <LegendItem color={CHART_COLORS.real} label="Venta real (52 semanas)" />
        <LegendItem color={CHART_COLORS.forecast} dashed label="Proyección" />
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm" style={{ background: CHART_COLORS.forecast, opacity: 0.25 }} aria-hidden="true" />
          Rango probable (≈80%)
        </li>
      </ul>

      <div className={`mt-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {error ? (
          <StateMessage variant="error" title="No pudimos cargar la proyección de este producto" detail={error.message} />
        ) : (
          <ForecastChart history={history} forecast={forecast} unit={product.unit} />
        )}
      </div>

      {!error && forecast.length > 0 && <ForecastWeekTable forecast={forecast} unit={product.unit} />}
    </section>
  )
}

export default ProductForecastPanel
