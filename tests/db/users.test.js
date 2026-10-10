// 0011: lista de usuarios y cambio de rol, solo para admin y sin dejar el sistema sin admin.
import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, createDb, createUser, errorOf } from './harness'

let db
let users

const rpc = (userId, sql, params) => asUser(db, userId, (tx) => tx.query(sql, params))

beforeAll(async () => {
  db = await createDb()
  users = {
    admin: await createUser(db, { email: 'admin@dimasa.test', role: 'admin', fullName: 'Ana Admin' }),
    compras: await createUser(db, { email: 'compras@dimasa.test', role: 'compras' }),
    nuevo: await createUser(db, { email: 'nuevo@dimasa.test' }),
  }
})

describe('0011 administración de usuarios', () => {
  it('admin ve todos los usuarios con su correo, pendientes primero', async () => {
    const { rows } = await rpc(users.admin, 'select * from public.list_users()')
    expect(rows).toHaveLength(3)
    expect(rows[0].email).toBe('nuevo@dimasa.test')
    expect(rows[0].role).toBe('pendiente')
    expect(rows.find((r) => r.email === 'admin@dimasa.test').full_name).toBe('Ana Admin')
  })

  it('compras y un visitante sin sesión no pueden ver la lista', async () => {
    expect(await errorOf(rpc(users.compras, 'select * from public.list_users()'))).toMatch(/Solo el administrador/)
    expect(await errorOf(rpc(null, 'select * from public.list_users()'))).toMatch(/permission denied/)
  })

  it('admin asigna un rol y el usuario pasa a ver datos', async () => {
    const { rows } = await rpc(users.admin, 'select public.set_user_role($1, $2) as r', [users.nuevo, 'gerencia'])
    expect(rows[0].r).toBe('gerencia')
    const { rows: role } = await rpc(users.nuevo, 'select public.current_user_role() as r')
    expect(role[0].r).toBe('gerencia')
  })

  it('compras no puede cambiar roles, ni el suyo', async () => {
    const msg = await errorOf(rpc(users.compras, 'select public.set_user_role($1, $2)', [users.compras, 'admin']))
    expect(msg).toMatch(/Solo el administrador/)
  })

  it('rechaza un rol inválido', async () => {
    const msg = await errorOf(rpc(users.admin, 'select public.set_user_role($1, $2)', [users.nuevo, 'superadmin']))
    expect(msg).toMatch(/Rol no válido/)
  })

  it('no deja quitar el rol al último administrador', async () => {
    const msg = await errorOf(rpc(users.admin, 'select public.set_user_role($1, $2)', [users.admin, 'compras']))
    expect(msg).toMatch(/último administrador/)
  })

  it('con dos admins, uno puede dejar de serlo', async () => {
    await rpc(users.admin, 'select public.set_user_role($1, $2)', [users.compras, 'admin'])
    const { rows } = await rpc(users.compras, 'select public.set_user_role($1, $2) as r', [users.admin, 'compras'])
    expect(rows[0].r).toBe('compras')
  })
})
