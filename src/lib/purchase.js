// Propuesta de compra: explicación de cada línea, agrupación por proveedor y exportación.
import { formatNumber, formatPercent } from './format'
import { addDays } from './forecast'

export const DECISIONS = {
  pendiente: { label: 'Pendiente', className: 'bg-concrete-200 text-graphite-700 ring-concrete-400' },
  aprobada: { label: 'Aprobada', className: 'bg-ok-50 text-ok-700 ring-ok-600/40' },
  ajustada: { label: 'Ajustada', className: 'bg-signal-100 text-signal-700 ring-signal-400/60' },
  rechazada: { label: 'Rechazada', className: 'bg-alert-50 text-alert-700 ring-alert-600/40' },
}

const REVIEW = { 7: 'semanal', 14: 'quincenal', 30: 'mensual' }

// "saco" → "sacos", "unidad" → "unidades"; abreviaturas (kg, m², m³) no cambian
export const pluralUnit = (qty, unit) => {
  if (Number(qty) === 1 || /\d|²|³|kg$/.test(unit)) return unit
  if (unit.endsWith('ón')) return `${unit.slice(0, -2)}ones`
  return /[aeiou]$/.test(unit) ? `${unit}s` : `${unit}es`
}
const decimal = (value) => formatNumber(Math.round(value * 10) / 10)

const orderQty = (line) =>
  line.capacity_cut ? Math.max(line.min_order_qty, Math.ceil(line.raw_qty / line.lot_size) * line.lot_size) : line.suggested_qty

export function lineReasons(line) {
  const u = (qty) => pluralUnit(qty, line.unit)
  const reasons = [
    `Debe cubrir ${decimal(line.cover_weeks)} semanas: reposición de ${line.lead_time_days} días + revisión ${REVIEW[line.review_days] ?? `cada ${line.review_days} días`}.`,
    `Venta proyectada en ese período: ${formatNumber(line.demand_qty)} ${u(line.demand_qty)}.`,
    `Stock de seguridad para ${formatPercent(line.service_level)} de servicio (celda ${line.abc_class}-${line.xyz_class}): ${formatNumber(line.safety_stock)} ${u(line.safety_stock)}.`,
    `Disponible: ${formatNumber(line.stock_qty)} en stock + ${formatNumber(line.in_transit_qty)} en camino.`,
    `Faltan ${formatNumber(line.raw_qty)} ${u(line.raw_qty)}; redondeado${line.lot_size > 1 ? ` al lote de ${line.lot_size}` : ''}${line.min_order_qty > 1 ? ` y al mínimo de ${line.min_order_qty}` : ''}: ${formatNumber(orderQty(line))} ${u(orderQty(line))}.`,
  ]
  if (line.capacity_cut) reasons.push(`No cabe en ${line.storage_zone === 'patio' ? 'el patio' : 'la bodega techada'} esta semana: se posterga por ser clase ${line.abc_class}.`)
  return reasons
}

export const arrivalDate = (line, orderDate) => addDays(orderDate, line.lead_time_days)

export function groupBySupplier(lines) {
  const groups = new Map()
  for (const line of lines) {
    if (!groups.has(line.supplier_id)) {
      groups.set(line.supplier_id, { supplierId: line.supplier_id, name: line.supplier_name, origin: line.origin, leadTime: line.lead_time_days, lines: [] })
    }
    groups.get(line.supplier_id).lines.push(line)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, value: g.lines.reduce((t, l) => t + l.final_qty * l.unit_cost, 0) }))
    .sort((a, b) => b.value - a.value)
}

export function summarizeProposal(lines) {
  const value = (list) => list.reduce((t, l) => t + l.final_qty * l.unit_cost, 0)
  const m2 = (zone) => lines.filter((l) => l.storage_zone === zone).reduce((t, l) => t + l.final_qty * l.m2_per_unit, 0)
  const count = (decision) => lines.filter((l) => l.decision === decision).length
  return {
    totalValue: value(lines),
    orderLines: lines.filter((l) => l.final_qty > 0).length,
    nationalValue: value(lines.filter((l) => l.origin === 'nacional')),
    importedValue: value(lines.filter((l) => l.origin === 'importado')),
    m2Bodega: m2('bodega'),
    m2Patio: m2('patio'),
    capacityCut: lines.filter((l) => l.capacity_cut).length,
    decisions: Object.fromEntries(Object.keys(DECISIONS).map((d) => [d, count(d)])),
  }
}

// CSV para Excel (separador ; y BOM UTF-8). Neutraliza fórmulas en celdas de texto.
const cell = (value) => {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function proposalCsv(lines, orderDate) {
  const header = ['Proveedor', 'Origen', 'SKU', 'Producto', 'Cantidad', 'Unidad', 'Costo unitario', 'Total', 'Ubicación', 'Llegada estimada', 'Decisión', 'Motivo']
  const rows = groupBySupplier(lines).flatMap((g) =>
    g.lines
      .filter((l) => l.final_qty > 0)
      .map((l) => [g.name, l.origin, l.sku, l.name, l.final_qty, l.unit, l.unit_cost, l.final_qty * l.unit_cost,
        l.storage_zone === 'patio' ? 'Patio' : 'Bodega techada', arrivalDate(l, orderDate), DECISIONS[l.decision].label, l.decision_reason ?? '']),
  )
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

