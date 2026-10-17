-- 0010 · El estado de stock (Diagnóstico) se guarda en una tabla en vez de calcularse en cada visita.
-- Mismo motivo que 0004: con las ventas reales de Random ERP la vista en vivo podría superar
-- el límite de 8 s de Supabase. La vista product_stock_status mantiene sus columnas y tipos,
-- así que las pantallas no cambian. Se recalcula con refresh_stock_status() o, junto con la
-- matriz y el forecast, con refresh_inventory_metrics() (botón y carga de datos).

-- ─── Resultado guardado ──────────────────────────────────────────────────────

create table public.product_stock_status_stored (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null,
  storage_zone text not null,
  unit text not null,
  supplier_name text not null,
  origin text not null,
  lead_time_days integer not null,
  ref_date date,
  stock_qty numeric not null,
  stock_value numeric not null,
  occupied_m2 numeric not null,
  avg_daily_qty numeric not null,
  coverage_days numeric,
  target_cover_days integer not null,
  last_sale_date date,
  days_since_last_sale integer,
  excess_value numeric not null,
  status text not null check (status in ('quiebre', 'sin_movimiento', 'sobrestock', 'riesgo_quiebre', 'inactivo', 'sano')),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.product_stock_status_stored enable row level security;

-- Solo lectura vía API; únicamente las funciones de abajo escriben.
create policy "product_stock_status_stored: lectura para usuarios con rol" on public.product_stock_status_stored
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

-- ─── Recalcular estado de stock ──────────────────────────────────────────────
-- El cálculo es el mismo de la vista de 0001 (fecha de referencia = última foto de stock).

create or replace function public.refresh_stock_status()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if (select auth.uid()) is not null
     and coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden recalcular el diagnóstico' using errcode = '42501';
  end if;

  delete from public.product_stock_status_stored where true;

  insert into public.product_stock_status_stored (
    product_id, sku, name, category, storage_zone, unit, supplier_name, origin, lead_time_days, ref_date,
    stock_qty, stock_value, occupied_m2, avg_daily_qty, coverage_days, target_cover_days,
    last_sale_date, days_since_last_sale, excess_value, status
  )
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
    select sa.product_id, max(sa.sale_date) as last_sale_date
    from public.sales sa
    group by sa.product_id
  ),
  base as (
    select
      p.id as product_id, p.sku, p.name, p.category, p.storage_zone, p.unit, p.unit_cost,
      sup.name as supplier_name, sup.origin, sup.lead_time_days, ref.ref_date,
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
    b.product_id, b.sku, b.name, b.category, b.storage_zone, b.unit, b.supplier_name, b.origin,
    b.lead_time_days, b.ref_date, b.stock_qty,
    b.stock_qty * b.unit_cost,
    b.stock_qty * b.m2_per_unit,
    round(b.avg_daily_qty, 3),
    case when b.avg_daily_qty > 0 then round(b.stock_qty / b.avg_daily_qty, 1) end,
    b.target_cover_days,
    b.last_sale_date,
    b.ref_date - b.last_sale_date,
    greatest(0, b.stock_qty - b.avg_daily_qty * b.target_cover_days) * b.unit_cost,
    case
      when b.stock_qty = 0 and b.avg_daily_qty > 0 then 'quiebre'
      when b.stock_qty > 0 and (b.last_sale_date is null or b.ref_date - b.last_sale_date >= 90) then 'sin_movimiento'
      when b.avg_daily_qty > 0 and b.stock_qty / b.avg_daily_qty > b.target_cover_days then 'sobrestock'
      when b.avg_daily_qty > 0 and b.stock_qty / b.avg_daily_qty < b.lead_time_days then 'riesgo_quiebre'
      when b.stock_qty = 0 then 'inactivo'
      else 'sano'
    end
  from base b;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke execute on function public.refresh_stock_status() from public, anon;
grant execute on function public.refresh_stock_status() to authenticated;

-- ─── Vista que lee la app (mismas columnas y tipos que en 0001) ───────────────

create or replace view public.product_stock_status
with (security_invoker = true) as
select
  product_id, sku, name, category, storage_zone, unit, supplier_name, origin, lead_time_days, ref_date,
  stock_qty, stock_value, occupied_m2, avg_daily_qty, coverage_days, target_cover_days,
  last_sale_date, days_since_last_sale, excess_value, status
from public.product_stock_status_stored;

revoke all on public.product_stock_status from anon;
grant select on public.product_stock_status to authenticated;

-- ─── Recalcular todo después de cargar datos ─────────────────────────────────
-- Orden: estado de stock → matriz ABC-XYZ → forecast (0005) → alertas (0008), estas dos si existen.

create or replace function public.refresh_inventory_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stock_count integer;
  class_count integer;
  forecast_count integer;
  alert_count integer;
begin
  if (select auth.uid()) is not null
     and coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden recalcular los indicadores' using errcode = '42501';
  end if;

  stock_count := public.refresh_stock_status();
  class_count := public.refresh_product_classifications();
  -- SQL dinámico para no depender en compilación de una función de otra migración
  if to_regprocedure('public.refresh_forecasts()') is not null then
    execute 'select public.refresh_forecasts()' into forecast_count;
  end if;
  -- Las alertas van al final: dependen del estado de stock, la matriz y el forecast
  if to_regprocedure('public.refresh_alerts()') is not null then
    execute 'select public.refresh_alerts()' into alert_count;
  end if;

  return jsonb_build_object(
    'stock_status', stock_count,
    'classifications', class_count,
    'forecasts', forecast_count,
    'alerts', alert_count
  );
end;
$$;
revoke execute on function public.refresh_inventory_metrics() from public, anon;
grant execute on function public.refresh_inventory_metrics() to authenticated;

-- Primer cálculo
select public.refresh_stock_status();
