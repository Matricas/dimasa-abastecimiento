-- 0011 · Administración de usuarios desde la app.
-- Los usuarios se crean o invitan desde el panel de Supabase (Authentication → Users): crearlos desde
-- el navegador exige la clave service_role, que no puede estar en el frontend. Aquí el admin solo
-- ve la lista de cuentas y les asigna un rol.

-- ─── Lista de usuarios (solo admin) ──────────────────────────────────────────
-- SECURITY DEFINER porque el correo vive en auth.users, que la API no expone.

create or replace function public.list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'Solo el administrador puede ver la lista de usuarios' using errcode = '42501';
  end if;

  return query
    select p.user_id, u.email::text, p.full_name, p.role, u.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.user_id
    order by (p.role = 'pendiente') desc, u.created_at desc;
end;
$$;
revoke execute on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

-- ─── Cambiar el rol (solo admin, nunca deja el sistema sin admin) ────────────

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role_of_target text;
  admin_count integer;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'Solo el administrador puede cambiar roles' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('pendiente', 'admin', 'compras', 'gerencia') then
    raise exception 'Rol no válido: %', coalesce(p_role, '(vacío)') using errcode = '22023';
  end if;

  -- Bloquea las filas de admin para que dos cambios simultáneos no dejen el sistema sin admin
  perform 1 from public.profiles where role = 'admin' for update;

  select role into current_role_of_target from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'El usuario no existe' using errcode = 'P0002';
  end if;

  if current_role_of_target = 'admin' and p_role <> 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin';
    if admin_count <= 1 then
      raise exception 'No se puede quitar el rol al último administrador' using errcode = '23514';
    end if;
  end if;

  update public.profiles set role = p_role where user_id = p_user_id;
  return p_role;
end;
$$;
revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
