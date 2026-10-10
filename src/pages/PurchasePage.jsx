import { useMemo, useState } from 'react'
import { CheckCheck, Download, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePurchaseProposal } from '../hooks/usePurchaseProposal'
import { DECISIONS, groupBySupplier, proposalCsv, summarizeProposal } from '../lib/purchase'
import { formatDate, formatDateTime } from '../lib/format'
import ProposalSummary from '../components/ProposalSummary'
import SupplierOrder from '../components/SupplierOrder'
import StateMessage from '../components/StateMessage'
import ConfirmButton from '../components/ConfirmButton'

function downloadCsv(proposal, lines) {
  const url = URL.createObjectURL(new Blob([proposalCsv(lines, proposal.created_at.slice(0, 10))], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `propuesta-compra-${proposal.origin_date}.csv` })
  link.click()
  URL.revokeObjectURL(url)
}

function PurchasePage() {
  const { proposal, lines, loading, busy, error, reload, generate, approve, decide } = usePurchaseProposal()
  const { profile } = useAuth()
  const canEdit = ['admin', 'compras'].includes(profile?.role)
  const isDraft = proposal?.status === 'borrador'
  const [filter, setFilter] = useState('todas')

  const summary = useMemo(() => summarizeProposal(lines), [lines])
  const groups = useMemo(() => groupBySupplier(filter === 'todas' ? lines : lines.filter((l) => l.decision === filter)), [lines, filter])
  const decided = lines.some((l) => l.decision !== 'pendiente')

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-graphite-500">Fase 4 · Compras</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight [font-stretch:108%]">Propuesta de compra</h1>
          {proposal && (
            <p className="mt-2 text-sm text-graphite-500">
              {isDraft ? 'Borrador' : `Aprobada el ${formatDateTime(proposal.approved_at)}`} · con datos al {formatDate(proposal.origin_date)} · generada el {formatDateTime(proposal.created_at)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {lines.length > 0 && (
            <ConfirmButton label="Descargar Excel" Icon={Download} onConfirm={() => downloadCsv(proposal, lines)} />
          )}
          {canEdit && (
            <ConfirmButton
              label={proposal ? 'Generar nueva propuesta' : 'Generar propuesta'}
              confirmLabel="Sí, generar de nuevo"
              warning={isDraft && decided ? 'Se reemplaza este borrador y se pierden las decisiones tomadas.' : null}
              busy={busy === 'generar'}
              disabled={busy !== null}
              Icon={RefreshCw}
              onConfirm={generate}
            />
          )}
          {canEdit && isDraft && lines.length > 0 && (
            <ConfirmButton
              primary
              label="Aprobar propuesta"
              confirmLabel="Sí, aprobar"
              warning={`Las ${summary.decisions.pendiente} líneas pendientes se aprueban tal como se sugirieron y lo pedido queda "en camino". No se puede deshacer.`}
              busy={busy === 'aprobar'}
              disabled={busy !== null}
              Icon={CheckCheck}
              onConfirm={approve}
            />
          )}
        </div>
      </header>

      {loading && !proposal && <div role="status" aria-label="Cargando propuesta" className="h-96 animate-pulse rounded-lg bg-concrete-200" />}

      {error && (
        <section className="rounded-lg border border-alert-600/30 bg-white">
          <StateMessage variant="error" title="No pudimos completar la acción" description="Revisa el detalle y vuelve a intentar." detail={[error.code, error.message].filter(Boolean).join(' · ')} onRetry={reload} retryLabel="Recargar" />
        </section>
      )}

      {!loading && !error && !proposal && (
        <section className="rounded-lg border border-concrete-300 bg-white">
          <StateMessage
            variant="empty"
            title="Aún no hay una propuesta de compra"
            description={canEdit ? 'Presiona "Generar propuesta" para calcular qué comprar esta semana con el forecast y la matriz ABC-XYZ.' : 'Compras genera la propuesta cada lunes.'}
          />
        </section>
      )}

      {!error && proposal && lines.length === 0 && (
        <section className="rounded-lg border border-concrete-300 bg-white">
          <StateMessage variant="empty" title="No hay nada que comprar esta semana" description="El stock y lo que viene en camino cubren la demanda proyectada de todos los productos." />
        </section>
      )}

      {!error && proposal && lines.length > 0 && (
        <>
          <ProposalSummary proposal={proposal} summary={summary} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por decisión">
            {['todas', ...Object.keys(DECISIONS)].map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${filter === key ? 'border-graphite-900 bg-graphite-900 text-white' : 'border-concrete-300 bg-white hover:border-graphite-400'}`}
              >
                {key === 'todas' ? 'Todas' : DECISIONS[key].label}{' '}
                <span className={`font-mono text-xs ${filter === key ? 'text-signal-400' : 'text-graphite-500'}`}>{key === 'todas' ? lines.length : summary.decisions[key]}</span>
              </button>
            ))}
          </div>
          {groups.length === 0 && <p className="text-sm text-graphite-500">No hay líneas con esa decisión.</p>}
          <div className="space-y-4">
            {groups.map((group) => (
              <SupplierOrder key={group.supplierId} group={group} orderDate={proposal.created_at.slice(0, 10)} editable={canEdit && isDraft} onDecide={decide} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default PurchasePage
