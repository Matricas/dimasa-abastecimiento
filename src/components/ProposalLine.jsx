import { useState } from 'react'
import { Check, ChevronDown, PencilLine, Undo2, X } from 'lucide-react'
import { DECISIONS, lineReasons } from '../lib/purchase'
import { formatNumber, formatShortCLP } from '../lib/format'
import LineEditor from './LineEditor'

const actionClass =
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

function ProposalLine({ line, editable, onDecide }) {
  const [open, setOpen] = useState(false)
  const [editor, setEditor] = useState(null) // 'ajustada' | 'rechazada'
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const decision = DECISIONS[line.decision]

  const quick = async (change) => {
    setSaving(true)
    setError('')
    try {
      await onDecide(line.id, change)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="grid grid-cols-3 gap-3 md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6rem_18.5rem] md:items-start">
        <div className="col-span-3 min-w-0 md:col-span-1">
          <p className="font-mono text-xs text-graphite-500">
            {line.sku} · {line.abc_class}-{line.xyz_class} · {line.storage_zone === 'patio' ? 'Patio' : 'Bodega'}
          </p>
          <p className="font-medium">{line.name}</p>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:underline">
            ¿Por qué esta cantidad?
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
        <p className="font-mono text-sm md:text-right">
          <span className="block text-xs text-graphite-500">Sugerido</span>
          {formatNumber(line.suggested_qty)} <span className="text-xs text-graphite-500">{line.unit}</span>
        </p>
        <p className="font-mono text-sm font-semibold md:text-right">
          <span className="block text-xs font-normal text-graphite-500">A pedir</span>
          {formatNumber(line.final_qty)}
        </p>
        <p className="font-mono text-sm md:text-right">
          <span className="block text-xs text-graphite-500">Valor</span>
          {formatShortCLP(line.final_qty * line.unit_cost)}
        </p>
        <div className="col-span-3 flex flex-wrap items-center gap-2 md:col-span-1 md:flex-nowrap md:justify-end">
          {!(editable && line.decision === 'pendiente') && (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${decision.className}`}>{decision.label}</span>
          )}
          {editable && line.decision === 'pendiente' && (
            <>
              <button type="button" disabled={saving} onClick={() => quick({ decision: 'aprobada' })} className={`${actionClass} border-ok-600/40 text-ok-700 hover:bg-ok-50`}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Aprobar
              </button>
              <button type="button" disabled={saving} onClick={() => setEditor('ajustada')} className={`${actionClass} border-concrete-300 text-graphite-700 hover:bg-concrete-100`}>
                <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Ajustar
              </button>
              <button type="button" disabled={saving} onClick={() => setEditor('rechazada')} className={`${actionClass} border-alert-600/30 text-alert-700 hover:bg-alert-50`}>
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Rechazar
              </button>
            </>
          )}
          {editable && line.decision !== 'pendiente' && (
            <button type="button" disabled={saving} onClick={() => quick({ decision: 'pendiente' })} className={`${actionClass} border-concrete-300 text-graphite-700 hover:bg-concrete-100`}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Deshacer
            </button>
          )}
        </div>
      </div>

      {line.decision_reason && <p className="mt-2 text-sm text-graphite-600">Motivo: {line.decision_reason}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-alert-700">{error}</p>}
      {open && (
        <ol className="mt-3 list-decimal space-y-1 rounded-md bg-concrete-50 py-3 pl-8 pr-4 text-sm text-graphite-700">
          {lineReasons(line).map((reason) => <li key={reason}>{reason}</li>)}
        </ol>
      )}
      {editor && (
        <LineEditor
          mode={editor}
          line={line}
          onCancel={() => setEditor(null)}
          onSave={async (change) => {
            await onDecide(line.id, change)
            setEditor(null)
          }}
        />
      )}
    </li>
  )
}

export default ProposalLine
