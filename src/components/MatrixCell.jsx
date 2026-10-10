import { formatMillions, formatNumber, formatPercent } from '../lib/format'
import { serviceLabel } from '../lib/abcXyz'

// A-X sostiene el despacho rápido; C-Z es candidato a liquidar
const TONES = {
  AX: 'bg-graphite-900 text-white border-graphite-900',
  CZ: 'bg-white border-alert-600/40 [background-image:repeating-linear-gradient(135deg,#FDECEA_0_6px,#FFFFFF_6px_12px)]',
}

function MatrixCell({ cell, selected, onSelect }) {
  const key = `${cell.abc}${cell.xyz}`
  const dark = key === 'AX'
  const muted = dark ? 'text-concrete-300' : 'text-graphite-500'

  return (
    <button
      type="button"
      onClick={() => onSelect(key)}
      aria-pressed={selected}
      aria-label={`Celda ${cell.abc}-${cell.xyz}: ${cell.count} productos, ${formatPercent(cell.marginShare)} del margen`}
      className={`relative flex min-h-[7.5rem] flex-col rounded-md border p-2.5 text-left transition sm:min-h-[10rem] sm:p-4 ${
        TONES[key] ?? 'border-concrete-300 bg-white hover:border-graphite-400'
      } ${selected ? 'ring-2 ring-signal-400 ring-offset-2 ring-offset-concrete-100' : ''}`}
    >
      <span className={`font-mono text-sm font-semibold sm:text-base ${dark ? 'text-signal-400' : ''}`}>
        {cell.abc}-{cell.xyz}
      </span>
      <span className="mt-1 font-mono text-xl font-semibold sm:mt-2 sm:text-2xl">{formatNumber(cell.count)}</span>
      <span className={`text-xs ${muted}`}>productos</span>
      <span className={`mt-1 text-xs sm:text-sm ${dark ? 'text-white' : 'text-graphite-700'}`}>
        {formatPercent(cell.marginShare)} <span className={`hidden sm:inline ${muted}`}>del margen</span>
      </span>
      <span className={`mt-auto hidden pt-3 font-mono text-xs sm:block ${muted}`}>
        Stock {formatMillions(cell.stockValue)} · Exceso {formatMillions(cell.excessValue)}
      </span>
      <span className={`hidden text-xs sm:block ${muted}`}>{serviceLabel(cell.policy.service_level)}</span>
    </button>
  )
}

export default MatrixCell
