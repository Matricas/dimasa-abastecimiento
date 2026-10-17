// Valida en local las migraciones existentes (0001 a 0005): que se apliquen, que las reglas de
// acceso por rol funcionen y que los cálculos guardados (matriz y forecast) den resultados.
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, errorOf } from './harness'
import { loadFixtures, PRODUCTS } from './fixtures'

let db
let users

beforeAll(async () => {
  db = await createDb()
  await loadFixtures(db)
  // Desde 0010 el diagnóstico se guarda: hay que recalcularlo después de cargar datos
  await db.query('select public.refresh_stock_status()')
  users = {
    admin: await createUser(db, { email: 'admin@dimasa.test', role: 'admin' }),
    compras: await createUser(db, { email: 'compras@dimasa.test', role: 'compras' }),
    gerencia: await createUser(db, { email: 'gerencia@dimasa.test', role: 'gerencia' }),
    pendiente: await createUser(db, { email: 'nuevo@dimasa.test' }),
  }
})

describe('migraciones existentes', () => {
  it('el trigger crea el perfil pendiente al registrar un usuario', async () => {
    const { rows } = await db.query('select role from public.profiles where user_id = $1', [users.pendiente])
    expect(rows[0].role).toBe('pendiente')
  })

  it('un visitante sin sesión no lee productos (RLS devuelve 0 filas)', async () => {
    const { rows } = await asUser(db, null, (tx) => tx.query('select * from public.products'))
    expect(rows).toHaveLength(0)
  })

  it('un visitante sin sesión no puede leer la vista de stock', async () => {
    const msg = await errorOf(asUser(db, null, (tx) => tx.query('select * from public.product_stock_status')))
    expect(msg).toMatch(/permission denied/i)
  })

  it('un usuario pendiente ve 0 filas', async () => {
    const { rows } = await asUser(db, users.pendiente, (tx) => tx.query('select * from public.products'))
    expect(rows).toHaveLength(0)
  })

  it('gerencia lee pero no puede insertar', async () => {
    const { rows } = await asUser(db, users.gerencia, (tx) => tx.query('select * from public.products'))
    expect(rows).toHaveLength(PRODUCTS.length)
    const msg = await errorOf(
      asUser(db, users.gerencia, (tx) =>
        tx.query(`insert into public.suppliers (name, origin, lead_time_days) values ('X', 'nacional', 3)`),
      ),
    )
    expect(msg).toMatch(/row-level security/i)
  })

  it('product_stock_status asigna los estados esperados', async () => {
    const { rows } = await asUser(db, users.compras, (tx) =>
      tx.query('select sku, status from public.product_stock_status order by sku'),
    )
    const bySku = Object.fromEntries(rows.map((r) => [r.sku, r.status]))
    expect(bySku['TST-0004']).toBe('sin_movimiento')
    expect(bySku['TST-0006']).toBe('quiebre')
    expect(bySku['TST-0002']).toBe('sobrestock')
  })

  it('compras recalcula la matriz y gerencia no puede', async () => {
    const { rows } = await asUser(db, users.compras, (tx) => tx.query('select public.refresh_product_classifications() as n'))
    expect(rows[0].n).toBe(PRODUCTS.length)
    const msg = await errorOf(
      asUser(db, users.gerencia, (tx) => tx.query('select public.refresh_product_classifications()')),
    )
    expect(msg).toMatch(/Solo admin y compras/)
    const { rows: classes } = await db.query(
      `select p.sku, c.abc_class, c.xyz_class from public.product_classifications c join public.products p on p.id = c.product_id`,
    )
    const cement = classes.find((c) => c.sku === 'TST-0001')
    expect(cement.abc_class).toBe('A')
    expect(cement.xyz_class).toBe('X')
  })

  it('el forecast se calcula y guarda su error típico', async () => {
    const { rows } = await asUser(db, users.admin, (tx) => tx.query('select public.refresh_forecasts() as n'))
    expect(rows[0].n).toBe(PRODUCTS.length)
    const { rows: fc } = await db.query(
      `select count(*)::int as n from public.product_forecasts f join public.products p on p.id = f.product_id where p.sku = 'TST-0005'`,
    )
    expect(fc[0].n).toBe(17) // importado: 17 semanas de horizonte
  })
})
