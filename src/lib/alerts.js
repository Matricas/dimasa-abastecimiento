import { Hourglass, Info, OctagonAlert, PackageX, Boxes, TriangleAlert, Warehouse } from 'lucide-react'

export const SEVERITIES = {
  critica: { label: 'Crítica', order: 0, Icon: OctagonAlert, badge: 'bg-alert-600 text-white ring-alert-700', bar: 'bg-alert-600' },
  alta: { label: 'Alta', order: 1, Icon: TriangleAlert, badge: 'bg-signal-100 text-signal-700 ring-signal-400/60', bar: 'bg-signal-400' },
  media: { label: 'Media', order: 2, Icon: Info, badge: 'bg-steel-50 text-steel-700 ring-steel-600/40', bar: 'bg-steel-600' },
}

export const ALERT_TYPES = {
  quiebre_inminente: { label: 'Quiebre inminente', Icon: PackageX, link: { to: '/compras', label: 'Ver propuesta de compra' } },
  sobrestock: { label: 'Sobrestock', Icon: Boxes, link: { to: '/diagnostico', label: 'Ver diagnóstico' } },
  sin_movimiento: { label: 'Sin movimiento', Icon: Hourglass, link: { to: '/diagnostico', label: 'Ver diagnóstico' } },
  ocupacion: { label: 'Bodega y patio', Icon: Warehouse, link: { to: '/diagnostico', label: 'Ver plano de ocupación' } },
}

export const sortAlerts = (alerts) =>
  [...alerts].sort(
    (a, b) => SEVERITIES[a.severity].order - SEVERITIES[b.severity].order || (b.value_clp ?? 0) - (a.value_clp ?? 0),
  )
