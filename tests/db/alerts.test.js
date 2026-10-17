// 0008: alertas calculadas y revisiones a nombre propio. Usa todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, errorOf } from './harness'
import { loadFixtures, productId } from './fixtures'

let db
let users
let firstKey

beforeAll(async () => {
  db = await createDb()
  await loadFixtures(db)
  users = {
    compras: await createUser(db, { email: 'compras@dimasa.test', role: 'compras' }),
    compras2: await createUser(db, { email: 'compras2@dimasa.test', role: 'compras' }),
    gerencia: await createUser(db, { email: 'gerencia@dimasa.test', role: 'gerencia' }),
  }
  const { rows } = await asUser(db, users.compras, (tx) => tx.query('select public.refresh_inventory_metrics() as r'))
  expect(rows[0].r.alerts).toBeGreaterThan(0)
  firstKey = (await db.query('select alert_key from public.alerts order by alert_key limit 1')).rows[0].alert_key
})

const alertsFor = async (sku) =>
  (await db.query('select alert_type, severity from public.alerts where product_id = $1', [await productId(db, sku)])).rows

describe('0008 alertas', () => {
  it('recalcular todo (0010) también recalcula las alertas', async () => {
    const { rows } = await db.query('select count(*)::int as n from public.alerts')
    expect(rows[0].n).toBeGreaterThan(0)
  })

  it('un producto sin stock que se vende genera alerta de quiebre', async () => {
    expect((await alertsFor('TST-0006')).map((a) => a.alert_type)).toContain('quiebre_inminente')
  })

  it('un producto sin ventas en 120 días genera alerta de sin movimiento', async () => {
    expect((await alertsFor('TST-0004')).map((a) => a.alert_type)).toContain('sin_movimiento')
  })

  it('gerencia lee las alertas pero no puede recalcularlas', async () => {
    const { rows } = await asUser(db, users.gerencia, (tx) => tx.query('select count(*)::int as n from public.alerts_overview'))
    expect(rows[0].n).toBeGreaterThan(0)
    expect(await errorOf(asUser(db, users.gerencia, (tx) => tx.query('select public.refresh_alerts()')))).toMatch(
      /Solo admin y compras/,
    )
  })

  it('compras marca una alerta como revisada a su nombre y queda oculta', async () => {
    await asUser(db, users.compras, (tx) => tx.query(`insert into public.alert_reviews (alert_key, note) values ($1, 'Ya pedido')`, [firstKey]))
    const { rows } = await asUser(db, users.gerencia, (tx) =>
      tx.query('select reviewed, review_note from public.alerts_overview where alert_key = $1', [firstKey]),
    )
    expect(rows[0]).toEqual({ reviewed: true, review_note: 'Ya pedido' })
  })

  it('nadie registra una revisión a nombre de otro usuario', async () => {
    const insertAsOther = asUser(db, users.compras, (tx) =>
      tx.query('insert into public.alert_reviews (alert_key, reviewed_by) values ($1, $2)', [firstKey, users.compras2]),
    )
    expect(await errorOf(insertAsOther)).toMatch(/row-level security/)
  })

  it('gerencia no puede revisar, y nadie borra revisiones ajenas', async () => {
    expect(await errorOf(asUser(db, users.gerencia, (tx) => tx.query('insert into public.alert_reviews (alert_key) values ($1)', [firstKey])))).toMatch(
      /row-level security/,
    )
    const { rows } = await asUser(db, users.compras2, (tx) =>
      tx.query('delete from public.alert_reviews where alert_key = $1 returning id', [firstKey]),
    )
    expect(rows).toHaveLength(0)
  })

  it('un visitante sin sesión no ve alertas', async () => {
    expect(await errorOf(asUser(db, null, (tx) => tx.query('select * from public.alerts_overview')))).toMatch(/permission denied/)
    const { rows } = await asUser(db, null, (tx) => tx.query('select count(*)::int as n from public.alerts'))
    expect(rows[0].n).toBe(0)
  })
})
