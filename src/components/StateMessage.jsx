import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'

const VARIANTS = {
  loading: { Icon: Loader2, iconClass: 'animate-spin text-graphite-500' },
  error: { Icon: AlertTriangle, iconClass: 'text-alert-600' },
  empty: { Icon: Inbox, iconClass: 'text-graphite-400' },
}

function StateMessage({ variant, title, description, detail, onRetry, retryLabel = 'Reintentar' }) {
  const { Icon, iconClass } = VARIANTS[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <Icon className={`h-8 w-8 ${iconClass}`} aria-hidden="true" />
      <p className="text-base font-semibold text-graphite-900">{title}</p>
      {description && <p className="max-w-md text-sm text-graphite-500">{description}</p>}
      {detail && <p className="max-w-md break-words font-mono text-xs text-graphite-400">Detalle técnico: {detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-graphite-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-graphite-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export default StateMessage
