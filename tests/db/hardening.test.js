// 0012: candado entre recálculos y protección del último administrador. Usa todas las migraciones.
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, errorOf } from './harness'
import { loadFixtures } from './fixtures'

const REFRESH_FUNCTIONS = [
  'refresh_stock_status',
  'refresh_product_classifications',
  'refresh_forecasts',
  'refresh_alerts',
  'generate_purchase_proposal',
  'refresh_inventory_metrics',
]

let db
let users

beforeAll(async () => {
  db = await createDb()
  await loadFixtures(db)
  users = {
    admin: await createUser(db, { email: 'admin@dimasa.test', role: 'admin' }),
    compras: await createUser(db, { email: 'compras@dimasa.test', role: 'compras' }),
  }
})

describe('0012 candado de recálculo', () => {
  it('todas las funciones que borran y rellenan tablas calculadas toman el candado', async () => {
    const { rows } = await db.query(
      `select proname from pg_proc where pronamespace = 'public'::regnamespace and prosrc like '%pg_advisory_xact_lock%'`,
    )
    expect(rows.map((r) => r.proname).sort()).toEqual([...REFRESH_FUNCTIONS].sort())
  })

  it('recalcular todo sigue funcionando y el candado es reentrante', async () => {
    const { rows } = await asUser(db, users.compras, (tx) => tx.query('select public.refresh_inventory_metrics() as r'))
    expect(rows[0].r.stock_status).toBe(8)
    expect(rows[0].r.alerts).toBeGreaterThan(0)
    const proposal = await asUser(db, users.compras, (tx) => tx.query('select public.generate_purchase_proposal() as id'))
    expect(proposal.rows[0].id).toBeTruthy()
  })
})

describe('0012 nunca sin administrador', () => {
  it('el único admin no puede quitarse el rol editando su perfil directo por la API', async () => {
    const direct = asUser(db, users.admin, (tx) =>
      tx.query(`update public.profiles set role = 'compras' where user_id = $1`, [users.admin]),
    )
    expect(await errorOf(direct)).toMatch(/último administrador/)
  })

  it('con dos admins, uno puede dejar de serlo por la vía directa', async () => {
    const second = await createUser(db, { email: 'admin2@dimasa.test', role: 'admin' })
    const { rows } = await asUser(db, users.admin, (tx) =>
      tx.query(`update public.profiles set role = 'gerencia' where user_id = $1 returning role`, [second]),
    )
    expect(rows[0].role).toBe('gerencia')
  })
})
