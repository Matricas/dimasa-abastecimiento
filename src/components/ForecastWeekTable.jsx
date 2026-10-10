import { formatNumber } from '../lib/format'
import { parseDate } from '../lib/forecast'

const dayMonth = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function ForecastWeekTable({ forecast, unit }) {
  return (
    <details className="group mt-4 rounded-md border border-concrete-300">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-graphite-700 hover:bg-concrete-50">
        Ver proyección semana a semana
      </summary>
      <div className="overflow-x-auto border-t border-concrete-300">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-concrete-50 text-xs uppercase tracking-wider text-graphite-500">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Semana</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Proyección</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Rango bajo – alto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-200 font-mono">
            {forecast.map((week) => (
              <tr key={week.week_start}>
                <td className="px-4 py-2 font-sans">
                  {week.horizon_week}. desde {dayMonth.format(parseDate(week.week_start))}
                </td>
                <td className="px-4 py-2 text-right">
                  {formatNumber(week.forecast_qty)} <span className="text-xs text-graphite-500">{unit}</span>
                </td>
                <td className="px-4 py-2 text-right text-graphite-600">
                  {formatNumber(week.low_qty)} – {formatNumber(week.high_qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export default ForecastWeekTable
