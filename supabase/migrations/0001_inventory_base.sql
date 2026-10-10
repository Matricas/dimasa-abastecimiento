-- 0001 · Base de inventario: perfiles con rol, zonas, proveedores, productos, ventas y stock.
-- Herramienta interna de una sola empresa: el acceso se controla por rol (admin, compras, gerencia).
-- Usuarios nuevos quedan en 'pendiente' (sin acceso) hasta que un admin les asigna rol.

-- ─── Perfiles y roles ────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'pendiente' check (role in ('pendiente', 'admin', 'compras', 'gerencia')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Rol del usuario en sesión. SECURITY DEFINER para leer profiles sin recursión de RLS.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = (select auth.uid())
$$;
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Crea el perfil (rol pendiente, sin acceso) al registrar un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles: cada usuario ve su perfil, admin ve todos"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

create policy "profiles: solo admin cambia perfiles"
  on public.profiles for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- ─── Zonas de almacenamiento ─────────────────────────────────────────────────

create table public.storage_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('bodega', 'patio')),
  name text not null,
  capacity_m2 numeric not null check (capacity_m2 > 0),
  created_at timestamptz not null default now()
);
alter table public.storage_zones enable row level security;

insert into public.storage_zones (code, name, capacity_m2) values
  ('bodega', 'Bodega techada', 4000),
  ('patio', 'Patio', 10000);

-- ─── Proveedores ─────────────────────────────────────────────────────────────

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  origin text not null check (origin in ('nacional', 'importado')),
  lead_time_days integer not null check (lead_time_days > 0),
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;

-- ─── Productos ───────────────────────────────────────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  unit text not null,
  supplier_id uuid not null references public.suppliers (id),
  storage_zone text not null references public.storage_zones (code),
  weather_resistant boolean not null default false,
  m2_per_unit numeric not null default 0 check (m2_per_unit >= 0), -- superficie por unidad, ya considerando apilado
  unit_cost numeric not null check (unit_cost >= 0),
  unit_price numeric not null check (unit_price >= 0),
  min_order_qty integer not null default 1 check (min_order_qty > 0),
  lot_size integer not null default 1 check (lot_size > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
create index products_supplier_id_idx on public.products (supplier_id);

-- ─── Ventas (agregadas por día, producto y canal) ────────────────────────────

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  product_id uuid not null references public.products (id) on delete cascade,
  channel text not null check (channel in ('minorista', 'empresas')), -- minorista = boletas, empresas = facturas
  quantity numeric not null,
  net_amount numeric not null,
  cost_amount numeric not null,
  created_at timestamptz not null default now(),
  unique (sale_date, product_id, channel)
);
alter table public.sales enable row level security;
create index sales_product_date_idx on public.sales (product_id, sale_date);
create index sales_date_idx on public.sales (sale_date);

-- ─── Stock (foto por fecha) ──────────────────────────────────────────────────

create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (snapshot_date, product_id)
);
alter table public.inventory_snapshots enable row level security;
create index inventory_snapshots_product_idx on public.inventory_snapshots (product_id);

-- ─── Políticas de datos de negocio ───────────────────────────────────────────
-- Lectura: admin, compras y gerencia (pendiente no ve nada). Escritura: admin y compras. Borrado: solo admin.

do $$
declare
  t text;
begin
  foreach t in array array['storage_zones', 'suppliers', 'products', 'sales', 'inventory_snapshots'] loop
    execute format(
      'create policy "%1$s: lectura para usuarios con rol" on public.%1$I for select to authenticated
         using ((select public.current_user_role()) in (''admin'', ''compras'', ''gerencia''))', t);
    execute format(
      'create policy "%1$s: compras y admin insertan" on public.%1$I for insert to authenticated
         with check ((select public.current_user_role()) in (''admin'', ''compras''))', t);
    execute format(
      'create policy "%1$s: compras y admin actualizan" on public.%1$I for update to authenticated
         using ((select public.current_user_role()) in (''admin'', ''compras''))
         with check ((select public.current_user_role()) in (''admin'', ''compras''))', t);
    execute format(
      'create policy "%1$s: solo admin borra" on public.%1$I for delete to authenticated
         using ((select public.current_user_role()) = ''admin'')', t);
  end loop;
end;
$$;

-- ─── Vista de estado de stock por producto ───────────────────────────────────
-- Fecha de referencia = última foto de stock (no now()), para que el cálculo sea reproducible.
-- Cobertura objetivo: 60 días nacional, 120 días importado.

create view public.product_stock_status
with (security_invoker = true) as
with ref as (
  select max(snapshot_date) as ref_date from public.inventory_snapshots
),
stock as (
  select s.product_id, s.quantity
  from public.inventory_snapshots s
  join ref on s.snapshot_date = ref.ref_date
),
sales_90d as (
  select sa.product_id, sum(sa.quantity) as qty_90d
  from public.sales sa
  join ref on sa.sale_date > ref.ref_date - 90 and sa.sale_date <= ref.ref_date
  group by sa.product_id
),
last_sale as (
  select product_id, max(sale_date) as last_sale_date
  from public.sales
  group by product_id
),
base as (
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.category,
    p.storage_zone,
    p.unit,
    p.unit_cost,
    sup.name as supplier_name,
    sup.origin,
    sup.lead_time_days,
    ref.ref_date,
    coalesce(st.quantity, 0) as stock_qty,
    coalesce(s90.qty_90d, 0) / 90.0 as avg_daily_qty,
    case when sup.origin = 'importado' then 120 else 60 end as target_cover_days,
    ls.last_sale_date,
    p.m2_per_unit
  from public.products p
  join public.suppliers sup on sup.id = p.supplier_id
  cross join ref
  left join stock st on st.product_id = p.id
  left join sales_90d s90 on s90.product_id = p.id
  left join last_sale ls on ls.product_id = p.id
  where p.active
)
select
  b.product_id,
  b.sku,
  b.name,
  b.category,
  b.storage_zone,
  b.unit,
  b.supplier_name,
  b.origin,
  b.lead_time_days,
  b.ref_date,
  b.stock_qty,
  b.stock_qty * b.unit_cost as stock_value,
  b.stock_qty * b.m2_per_unit as occupied_m2,
  round(b.avg_daily_qty, 3) as avg_daily_qty,
  case when b.avg_daily_qty > 0 then round(b.stock_qty / b.avg_daily_qty, 1) end as coverage_days,
  b.target_cover_days,
  b.last_sale_date,
  b.ref_date - b.last_sale_date as days_since_last_sale,
  greatest(0, b.stock_qty - b.avg_daily_qty * b.target_cover_days) * b.unit_cost as excess_value,
  case
    when b.stock_qty = 0 and b.avg_daily_qty > 0 then 'quiebre'
    when b.stock_qty > 0 and (b.last_sale_date is null or b.ref_date - b.last_sale_date >= 90) then 'sin_movimiento'
    when b.avg_daily_qty > 0 and b.stock_qty / b.avg_daily_qty > b.target_cover_days then 'sobrestock'
    when b.avg_daily_qty > 0 and b.stock_qty / b.avg_daily_qty < b.lead_time_days then 'riesgo_quiebre'
    when b.stock_qty = 0 then 'inactivo'
    else 'sano'
  end as status
from base b;

revoke all on public.product_stock_status from anon;
grant select on public.product_stock_status to authenticated;
