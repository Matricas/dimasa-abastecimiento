import { formatDate, formatNumber, formatShortCLP } from '../lib/format'
import { addDays } from '../lib/forecast'
import ProposalLine from './ProposalLine'

function SupplierOrder({ group, orderDate, editable, onDecide }) {
  const arrival = addDays(orderDate, group.leadTime)
  return (
    <section className="overflow-hidden rounded-lg border border-concrete-300 bg-white">
      <header className="flex flex-col gap-2 border-b border-concrete-300 bg-concrete-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="font-semibold">{group.name}</h3>
          <p className="text-xs text-graphite-500">
            {group.origin === 'importado' ? 'Importado' : 'Nacional'} · reposición {group.leadTime} días · llegaría el {formatDate(arrival)}
          </p>
        </div>
        <p className="font-mono text-sm">
          {formatNumber(group.lines.length)} productos · <span className="font-semibold">{formatShortCLP(group.value)}</span>
        </p>
      </header>
      <ul className="divide-y divide-concrete-200">
        {group.lines.map((line) => (
          <ProposalLine key={line.id} line={line} editable={editable} onDecide={onDecide} />
        ))}
      </ul>
    </section>
  )
}

export default SupplierOrder
