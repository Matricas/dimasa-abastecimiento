import { formatMillions, formatPercent } from '../lib/format'

function CategoryExcess({ categories }) {
  const top = categories.filter((c) => c.excessValue > 0).slice(0, 8)
  const max = top[0]?.excessValue ?? 0

  return (
    <section className="rounded-lg border border-concrete-300 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Dónde está el exceso</h2>
      <p className="mt-1 text-sm text-graphite-500">Capital sobre la cobertura objetivo, por categoría.</p>

      {top.length === 0 ? (
        <p className="mt-6 text-sm text-graphite-500">Ninguna categoría supera su cobertura objetivo.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {top.map((c) => (
            <li key={c.category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{c.category}</span>
                <span className="shrink-0 font-mono">{formatMillions(c.excessValue)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-concrete-200">
                <div className="h-2 rounded-full bg-signal-400" style={{ width: `${(c.excessValue / max) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-graphite-500">{formatPercent(c.excessValue / c.stockValue)} de su stock</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default CategoryExcess
