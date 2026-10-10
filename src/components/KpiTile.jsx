const TONES = {
  default: 'border-concrete-300 bg-white',
  highlight: 'border-graphite-900 bg-graphite-900 text-white',
  alert: 'border-alert-600/40 bg-white',
}

function KpiTile({ label, value, detail, tone = 'default' }) {
  const isHighlight = tone === 'highlight'
  return (
    <article className={`relative overflow-hidden rounded-lg border p-5 ${TONES[tone]}`}>
      {isHighlight && <div className="absolute inset-x-0 top-0 h-1.5 bg-safety-stripe" aria-hidden="true" />}
      <h3
        className={`text-xs font-semibold uppercase tracking-wider ${
          isHighlight ? 'text-signal-400' : tone === 'alert' ? 'text-alert-700' : 'text-graphite-500'
        }`}
      >
        {label}
      </h3>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-2 text-sm leading-snug ${isHighlight ? 'text-concrete-300' : 'text-graphite-500'}`}>{detail}</p>
    </article>
  )
}

export default KpiTile
