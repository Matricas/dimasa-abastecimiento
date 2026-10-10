import { STATUS } from '../lib/diagnostics'

function StatusBadge({ status }) {
  const { label, className } = STATUS[status] ?? STATUS.inactivo
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  )
}

export default StatusBadge
