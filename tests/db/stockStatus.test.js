// 0010: el Diagnóstico pasa a leerse de una tabla guardada sin cambiar lo que ve la pantalla.
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMigration, asUser, createDb, createUser, errorOf } from './harness'
import { loadFixtures } from './fixtures'

const SELECT_ALL = 'select * from public.product_stock_status order by product_id'

let db
let users
let before

beforeAll(async () => {
  db = await createDb({ upTo: 5 })
  await loadFixtures(db)
  before = (await db.query(SELECT_ALL)).rows
  await applyMigration(db, 10)
  users = {
    compras: await createUser(db, { email: 'compras@dimasa.test', role: 'compras' }),
    gerencia: await createUser(db, { email: 'gerencia@dimasa.test', role: 'gerencia' }),
  }
})

describe('0010 estado de stock guardado', () => {
  it('la vista entrega exactamente lo mismo que antes de la migración', async () => {
    const after = (await db.query(SELECT_ALL)).rows
    expect(after).toHaveLength(before.length)
    // numeric llega como string desde PGlite; se compara valor a valor
    expect(after.map((r) => ({ ...r }))).toEqual(before.map((r) => ({ ...r })))
  })

  it('las columnas de la vista no cambian de orden ni de tipo', async () => {
    const cols = `select column_name, data_type from information_schema.columns
                  where table_schema = 'public' and table_name = 'product_stock_status' order by ordinal_position`
    const { rows } = await db.query(cols)
    expect(rows.map((r) => r.column_name)).toEqual(Object.keys(before[0]))
  })

  it('una venta nueva no cambia el diagnóstico hasta recalcular', async () => {
    await db.query(
      `delete from public.inventory_snapshots where product_id = (select id from public.products where sku = 'TST-0006')`,
    )
    await db.query(
      `insert into public.inventory_snapshots (snapshot_date, product_id, quantity)
       select '2026-10-05', id, 500 from public.products where sku = 'TST-0006'`,
    )
    const status = async () =>
      (await db.query(`select status from public.product_stock_status where sku = 'TST-0006'`)).rows[0].status
    expect(await status()).toBe('quiebre')
    const { rows } = await asUser(db, users.compras, (tx) => tx.query('select public.refresh_inventory_metrics() as r'))
    expect(rows[0].r.stock_status).toBe(8)
    expect(rows[0].r.classifications).toBe(8)
    expect(rows[0].r.forecasts).toBe(8)
    expect(rows[0].r.alerts).toBeNull() // esta base no tiene 0008: se salta sin error
    expect(await status()).not.toBe('quiebre')
  })

  it('gerencia lee el diagnóstico pero no puede recalcular ni escribir la tabla', async () => {
    const { rows } = await asUser(db, users.gerencia, (tx) => tx.query(SELECT_ALL))
    expect(rows).toHaveLength(8)
    expect(await errorOf(asUser(db, users.gerencia, (tx) => tx.query('select public.refresh_inventory_metrics()')))).toMatch(
      /Solo admin y compras/,
    )
    // Sin política de borrado, RLS no deja borrar nada (0 filas afectadas), ni siquiera a compras
    const res = await asUser(db, users.compras, (tx) => tx.query('delete from public.product_stock_status_stored where true'))
    expect(res.affectedRows).toBe(0)
    const { rows: still } = await db.query('select count(*)::int as n from public.product_stock_status_stored')
    expect(still[0].n).toBe(8)
  })
})
