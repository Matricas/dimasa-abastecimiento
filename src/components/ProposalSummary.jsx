import { formatMillions, formatNumber } from '../lib/format'
import KpiTile from './KpiTile'

function SpaceBar({ label, needed, free }) {
  const ratio = free > 0 ? Math.min(needed / free, 1) : 1
  const over = needed > free
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={`font-mono text-xs ${over ? 'font-semibold text-alert-700' : 'text-graphite-500'}`}>
          {formatNumber(needed)} de {formatNumber(free)} m² libres
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-concrete-200">
        <div className={`h-2 rounded-full ${over ? 'bg-alert-600' : 'bg-graphite-700'}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

function ProposalSummary({ proposal, summary }) {
  const { decisions } = summary
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        tone="highlight"
        label="Total a comprar"
        value={formatMillions(summary.totalValue)}
        detail={`${formatNumber(summary.orderLines)} productos, a costo. Nacional ${formatMillions(summary.nationalValue)} · importado ${formatMillions(summary.importedValue)}.`}
      />
      <KpiTile
        label="Decisiones"
        value={`${formatNumber(decisions.pendiente)} pendientes`}
        detail={`Aprobadas: ${decisions.aprobada} · ajustadas: ${decisions.ajustada} · rechazadas: ${decisions.rechazada}`}
      />
      <article className="rounded-lg border border-concrete-300 bg-white p-5 sm:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite-500">Espacio que ocupará lo pedido</h3>
        <div className="mt-4 space-y-4">
          <SpaceBar label="Bodega techada" needed={summary.m2Bodega} free={proposal.free_m2_bodega} />
          <SpaceBar label="Patio" needed={summary.m2Patio} free={proposal.free_m2_patio} />
        </div>
        <p className="mt-3 text-xs text-graphite-500">
          {summary.capacityCut > 0 ? `${summary.capacityCut} productos B o C se postergaron por falta de espacio. ` : ''}
          {proposal.on_demand_skipped} productos C-Z no se reponen: se compran bajo pedido.
        </p>
      </article>
    </div>
  )
}

export default ProposalSummary
