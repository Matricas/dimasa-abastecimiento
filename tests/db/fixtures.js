// Datos chicos y deterministas para los tests: 2 proveedores, 8 productos, 40 semanas de ventas
// y una foto de stock. Cada producto representa un caso que las pantallas tienen que mostrar bien.

export const REF_DATE = '2026-10-05' // lunes; fecha de la foto de stock
const HISTORY_DAYS = 280 // 40 semanas

export const SUPPLIERS = [
  { name: 'Cementos Test', origin: 'nacional', lead_time_days: 4 },
  { name: 'Import Test', origin: 'importado', lead_time_days: 49 },
]

// daily: venta diaria base; pattern: 'stable' | 'erratic' | 'dead' (sin venta en los últimos 120 días)
export const PRODUCTS = [
  { sku: 'TST-0001', name: 'Cemento test 25 kg', supplier: 'Cementos Test', zone: 'bodega', cost: 4000, price: 5600, daily: 40, pattern: 'stable', stockDays: 20, m2: 0.02, lot: 10 },
  { sku: 'TST-0002', name: 'Fierro test 8 mm', supplier: 'Cementos Test', zone: 'patio', cost: 3000, price: 4200, daily: 20, pattern: 'stable', stockDays: 200, m2: 0.03, lot: 1 },
  { sku: 'TST-0003', name: 'Teja test caja', supplier: 'Cementos Test', zone: 'bodega', cost: 20000, price: 26000, daily: 1, pattern: 'erratic', stockDays: 30, m2: 0.04, lot: 1 },
  { sku: 'TST-0004', name: 'Pintura test galón', supplier: 'Cementos Test', zone: 'bodega', cost: 9000, price: 12000, daily: 2, pattern: 'dead', stock: 80, m2: 0.01, lot: 1 },
  { sku: 'TST-0005', name: 'Cerámica test m²', supplier: 'Import Test', zone: 'bodega', cost: 6000, price: 8400, daily: 10, pattern: 'stable', stockDays: 30, m2: 0.05, lot: 20 },
  { sku: 'TST-0006', name: 'Mortero test 25 kg', supplier: 'Cementos Test', zone: 'bodega', cost: 3000, price: 4000, daily: 15, pattern: 'stable', stock: 0, m2: 0.02, lot: 10 },
  { sku: 'TST-0007', name: 'Arena test saco', supplier: 'Cementos Test', zone: 'patio', cost: 1500, price: 2000, daily: 30, pattern: 'stable', stockDays: 150, m2: 0.02, lot: 50 },
  { sku: 'TST-0008', name: 'Fragüe test 1 kg', supplier: 'Cementos Test', zone: 'bodega', cost: 1200, price: 1500, daily: 0.3, pattern: 'erratic', stockDays: 60, m2: 0.001, lot: 1 },
]

function lcg(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function salesRows() {
  const rand = lcg(42)
  const rows = []
  PRODUCTS.forEach((p) => {
    for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
      const date = addDays(REF_DATE, -back)
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
      if (dow === 0) continue
      if (p.pattern === 'dead' && back < 120) continue
      let qty
      if (p.pattern === 'erratic') qty = rand() < 0.12 ? Math.round((p.daily / 0.12) * (0.5 + rand())) : 0
      else qty = Math.round(p.daily * (0.85 + 0.3 * rand()))
      if (qty <= 0) continue
      const empresas = p.pattern === 'stable' && dow >= 1 && dow <= 5 && rand() < 0.2
      rows.push({ sku: p.sku, date, channel: empresas ? 'empresas' : 'minorista', qty, price: p.price, cost: p.cost })
    }
  })
  return rows
}

export function stockQty(p) {
  if (p.stock !== undefined) return p.stock
  return Math.round(p.daily * p.stockDays)
}

// Inserta todo como superusuario (como el SQL Editor de Supabase).
export async function loadFixtures(db) {
  for (const s of SUPPLIERS) {
    await db.query('insert into public.suppliers (name, origin, lead_time_days) values ($1, $2, $3)', [s.name, s.origin, s.lead_time_days])
  }
  for (const p of PRODUCTS) {
    await db.query(
      `insert into public.products (sku, name, category, unit, supplier_id, storage_zone, m2_per_unit, unit_cost, unit_price, min_order_qty, lot_size)
       values ($1, $2, 'Test', 'unidad', (select id from public.suppliers where name = $3), $4, $5, $6, $7, $8, $8)`,
      [p.sku, p.name, p.supplier, p.zone, p.m2, p.cost, p.price, p.lot],
    )
  }
  const sales = salesRows()
  const payload = JSON.stringify(sales)
  await db.query(
    `insert into public.sales (sale_date, product_id, channel, quantity, net_amount, cost_amount)
     select (r->>'date')::date, p.id, r->>'channel', (r->>'qty')::numeric,
            (r->>'qty')::numeric * (r->>'price')::numeric, (r->>'qty')::numeric * (r->>'cost')::numeric
     from jsonb_array_elements($1::jsonb) r
     join public.products p on p.sku = r->>'sku'
     on conflict (sale_date, product_id, channel) do update
       set quantity = public.sales.quantity + excluded.quantity,
           net_amount = public.sales.net_amount + excluded.net_amount,
           cost_amount = public.sales.cost_amount + excluded.cost_amount`,
    [payload],
  )
  for (const p of PRODUCTS) {
    await db.query(
      `insert into public.inventory_snapshots (snapshot_date, product_id, quantity)
       values ($1, (select id from public.products where sku = $2), $3)`,
      [REF_DATE, p.sku, stockQty(p)],
    )
  }
  return { salesCount: sales.length }
}

export async function productId(db, sku) {
  const { rows } = await db.query('select id from public.products where sku = $1', [sku])
  return rows[0].id
}
