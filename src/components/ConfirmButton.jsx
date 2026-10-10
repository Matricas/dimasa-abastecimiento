import { useState } from 'react'
import { Loader2 } from 'lucide-react'

// Acción con confirmación en dos pasos (sin diálogos del navegador)
function ConfirmButton({ label, confirmLabel, warning, busy, disabled, onConfirm, Icon, primary = false }) {
  const [asking, setAsking] = useState(false)
  const base = 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60'
  const style = primary
    ? 'bg-signal-400 text-graphite-900 hover:bg-signal-300'
    : 'border border-concrete-300 bg-white hover:border-graphite-900'

  if (asking && !busy) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-signal-400 bg-signal-100 p-3 sm:max-w-sm">
        <p className="text-sm text-graphite-800">{warning}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setAsking(false); onConfirm() }} className={`${base} bg-graphite-900 text-white hover:bg-graphite-700`}>
            {confirmLabel}
          </button>
          <button type="button" onClick={() => setAsking(false)} className={`${base} hover:bg-white`}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }
  return (
    <button type="button" disabled={disabled || busy} onClick={() => (warning ? setAsking(true) : onConfirm())} className={`${base} ${style}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  )
}

export default ConfirmButton
