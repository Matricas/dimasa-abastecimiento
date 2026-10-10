import { formatPercent } from '../lib/format'
import KpiTile from './KpiTile'

const pct = (value) => (value === null ? '—' : formatPercent(value))

function verdict({ model, lastYear }) {
  if (model === null || lastYear === null) return 'Sin ventas suficientes para comparar.'
  const diff = (lastYear - model) * 100
  if (diff > 0) return `Se equivoca ${diff.toFixed(1).replace('.', ',')} puntos menos que "lo mismo que el año pasado".`
  return `Hoy se equivoca ${(-diff).toFixed(1).replace('.', ',')} puntos más que "lo mismo que el año pasado". No conviene usarlo todavía.`
}

function AccuracyPanel({ accuracy }) {
  const { overall, byClass } = accuracy
  const bias = overall.bias ?? 0
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile tone="highlight" label="Error del forecast" value={pct(overall.model)} detail={verdict(overall)} />
        <KpiTile label="Método actual: año anterior" value={pct(overall.lastYear)} detail={`El forecast le gana en ${overall.winsVsLastYear} de ${overall.evaluated} productos.`} />
        <KpiTile label="Promedio 4 semanas previas" value={pct(overall.last4w)} detail="Otro método simple de referencia." />
        <KpiTile
          tone={Math.abs(bias) > 0.1 ? 'alert' : 'default'}
          label="Sesgo"
          value={pct(overall.bias)}
          detail={bias < 0 ? 'Tiende a proyectar menos de lo que se vende: ojo con quiebres.' : 'Tiende a proyectar más de lo que se vende: ojo con sobrestock.'}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-concrete-300 bg-white">
        <table className="min-w-full text-left text-sm">
          <caption className="px-5 pt-4 text-left text-sm text-graphite-500">
            Error semanal (WAPE) en las últimas 12 semanas, proyectadas como si fuera hace 12 semanas. Menor es mejor.
          </caption>
          <thead className="text-xs uppercase tracking-wider text-graphite-500">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold">Clase</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold">Forecast</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold">Año anterior</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold">4 semanas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-concrete-200 font-mono">
            {byClass.map((c) => {
              const best = Math.min(...[c.model, c.lastYear, c.last4w].filter((v) => v !== null))
              const cell = (v) => `px-5 py-2.5 text-right ${v === best ? 'font-semibold text-graphite-900' : 'text-graphite-600'}`
              return (
                <tr key={c.abc}>
                  <td className="px-5 py-2.5 font-sans">Clase {c.abc} <span className="text-graphite-500">· {c.count} productos</span></td>
                  <td className={cell(c.model)}>{pct(c.model)}</td>
                  <td className={cell(c.lastYear)}>{pct(c.lastYear)}</td>
                  <td className={cell(c.last4w)}>{pct(c.last4w)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AccuracyPanel
