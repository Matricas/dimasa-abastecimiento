import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const inputClass =
  'rounded-md border border-concrete-300 bg-white px-3 py-2 text-sm transition-colors hover:border-graphite-400 focus:border-graphite-900 focus:outline-none focus:ring-2 focus:ring-signal-400'

function LineEditor({ mode, line, onSave, onCancel }) {
  const [qty, setQty] = useState(String(line.final_qty))
  const [reason, setReason] = useState(line.decision_reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const adjusting = mode === 'ajustada'
  const qtyValue = Number(qty)
  const valid = reason.trim().length > 0 && (!adjusting || (qty !== '' && qtyValue >= 0))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ decision: mode, finalQty: adjusting ? qtyValue : undefined, reason: reason.trim() })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border border-concrete-300 bg-concrete-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {adjusting && (
          <label className="text-sm font-medium text-graphite-700">
            Cantidad a pedir ({line.unit})
            <input type="number" min="0" step={line.lot_size} value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputClass} mt-1 block w-36 font-mono`} />
          </label>
        )}
        <label className="flex-1 text-sm font-medium text-graphite-700">
          Motivo {adjusting ? 'del ajuste' : 'del rechazo'}
          <input
            type="text"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={adjusting ? 'Ej.: el proveedor solo despacha 200 esta semana' : 'Ej.: el producto se va a descontinuar'}
            className={`${inputClass} mt-1 block w-full`}
          />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-alert-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!valid || saving} className="inline-flex items-center gap-2 rounded-md bg-graphite-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-graphite-700 disabled:cursor-not-allowed disabled:bg-concrete-300 disabled:text-graphite-500">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {adjusting ? 'Guardar ajuste' : 'Rechazar línea'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-graphite-700 transition-colors hover:bg-concrete-200">
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default LineEditor
