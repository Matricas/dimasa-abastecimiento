// Base de datos de prueba en memoria (PGlite = Postgres real compilado a WebAssembly).
// Imita lo mínimo de Supabase que usan las migraciones: esquema auth, auth.uid(),
// roles anon/authenticated y los permisos por defecto que Supabase da al esquema public.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')

const SUPABASE_MOCK = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    last_sign_in_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
}

// Crea una base nueva con las migraciones aplicadas. `upTo` limita hasta un número (ej. 4 → 0001..0004).
export async function createDb({ upTo = Infinity, beforeMigration } = {}) {
  const db = new PGlite()
  await db.exec(SUPABASE_MOCK)
  for (const file of migrationFiles()) {
    const number = Number(file.slice(0, 4))
    if (number > upTo) break
    if (beforeMigration) await beforeMigration(db, number)
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

// Aplica una migración puntual por número (para comparar antes y después).
export async function applyMigration(db, number) {
  const file = migrationFiles().find((f) => Number(f.slice(0, 4)) === number)
  if (!file) throw new Error(`No existe la migración ${number}`)
  await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
}

// Crea un usuario en auth.users (el trigger le crea el perfil 'pendiente') y le asigna el rol.
export async function createUser(db, { email, role = 'pendiente', fullName = null }) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [email, fullName],
  )
  const id = rows[0].id
  if (role !== 'pendiente') {
    await db.query('update public.profiles set role = $1 where user_id = $2', [role, id])
  }
  return id
}

// Ejecuta `fn` como un usuario con sesión (rol authenticated + auth.uid()), igual que la API de Supabase.
// Sin userId, ejecuta como visitante sin sesión (anon). Siempre vuelve al superusuario al terminar.
export async function asUser(db, userId, fn) {
  return db.transaction(async (tx) => {
    if (userId) {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId])
      await tx.exec('set local role authenticated')
    } else {
      await tx.exec('set local role anon')
    }
    return fn(tx)
  })
}

// Espera que la promesa falle y devuelve el mensaje de error.
export async function errorOf(promise) {
  try {
    await promise
  } catch (err) {
    return err.message
  }
  throw new Error('Se esperaba un error y la consulta funcionó')
}
