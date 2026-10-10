-- 0004 · La matriz ABC-XYZ se guarda en una tabla en vez de calcularse en cada visita.
-- Calcularla en vivo superaba el límite de 8 s de Supabase para usuarios (statement timeout)
-- y no escalaría con los datos reales de Random ERP. La clasificación se actualiza cuando
-- admin o compras presionan "Recalcular" (o al cargar datos nuevos), no en cada lectura.

drop view if exists public.product_abc_xyz;

-- ─── Resultado de la clasificación ───────────────────────────────────────────

create table public.product_classifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  revenue_12m numeric not null,
  margin_12m numeric not null,
  margin_share numeric not null,
  abc_class text not null check (abc_class in ('A', 'B', 'C')),
  weekly_mean numeric,
  weekly_cv numeric,
  history_weeks integer not null,
  xyz_class text not null check (xyz_class in ('X', 'Y', 'Z')),
  seasonality_weight numeric,
  peak_month integer,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.product_classifications enable row level security;

-- Solo lectura vía API; únicamente la función de abajo escribe.
create policy "product_classifications: lectura para usuarios con rol" on public.product_classifications
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

-- ─── Recalcular ──────────────────────────────────────────────────────────────

create or replace function public.refresh_product_classifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  -- Desde la app solo admin y compras. Sin sesión (SQL Editor, tareas programadas) se permite.
  if (select auth.uid()) is not null
     and coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden recalcular la matriz' using errcode = '42501';
  end if;

  delete from public.product_classifications where true;

  insert into public.product_classifications (
    product_id, revenue_12m, margin_12m, margin_share, abc_class, weekly_mean, weekly_cv,
    history_weeks, xyz_class, seasonality_weight, peak_month
  )
    with ref as (
      select max(snapshot_date) as ref_date from public.inventory_snapshots
    ),
    margin_12m as (
      select sa.product_id,
        sum(sa.net_amount) as revenue_12m,
        sum(sa.net_amount - sa.cost_amount) as margin_12m
      from public.sales sa
      join ref on sa.sale_date > ref.ref_date - 365 and sa.sale_date <= ref.ref_date
      group by sa.product_id
    ),
    first_sale as (
      select product_id, min(sale_date) as first_sale_date from public.sales group by product_id
    ),
    -- semana 0 = los 7 días que terminan en la fecha de referencia
    weekly as (
      select sa.product_id, (ref.ref_date - sa.sale_date) / 7 as week_idx, sum(sa.quantity) as qty
      from public.sales sa
      join ref on sa.sale_date > ref.ref_date - 364 and sa.sale_date <= ref.ref_date
      group by sa.product_id, week_idx
    ),
    weekly_stats as (
      select w.product_id,
        sum(w.qty) as qty_52w,
        sum(w.qty * w.qty) as qty_sq_52w
      from weekly w
      group by w.product_id
    ),
    -- meses completos de los últimos 24, con ceros donde no hubo venta
    months as (
      select generate_series(
        date_trunc('month', ref.ref_date) - interval '24 months',
        date_trunc('month', ref.ref_date) - interval '1 month',
        interval '1 month'
      )::date as month_start
      from ref
    ),
    monthly_sales as (
      select sa.product_id, date_trunc('month', sa.sale_date)::date as month_start, sum(sa.quantity) as qty
      from public.sales sa
      join ref
        on sa.sale_date >= (date_trunc('month', ref.ref_date) - interval '24 months')::date
       and sa.sale_date < date_trunc('month', ref.ref_date)::date
      group by sa.product_id, month_start
    ),
    monthly as (
      select p.id as product_id, m.month_start, coalesce(ms.qty, 0) as qty
      from public.products p
      cross join months m
      left join monthly_sales ms on ms.product_id = p.id and ms.month_start = m.month_start
    ),
    month_of_year as (
      select product_id, extract(month from month_start)::int as month_num, avg(qty) as avg_qty
      from monthly
      group by product_id, month_num
    ),
    seasonality as (
      select product_id,
        case when sum(avg_qty) > 0
          then least(1, (max(avg_qty) - min(avg_qty)) / (max(avg_qty) + min(avg_qty)))
        end as seasonality_weight,
        (array_agg(month_num order by avg_qty desc, month_num))[1] as peak_month
      from month_of_year
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
        coalesce(m.revenue_12m, 0) as revenue_12m,
        coalesce(m.margin_12m, 0) as margin_12m,
        -- semanas con historial dentro de la ventana (productos nuevos tienen menos)
        least(52, greatest(1, ceil((ref.ref_date - fs.first_sale_date + 1) / 7.0)))::int as history_weeks,
        ws.qty_52w,
        ws.qty_sq_52w,
        s.seasonality_weight,
        s.peak_month
      from public.products p
      cross join ref
      left join margin_12m m on m.product_id = p.id
      left join first_sale fs on fs.product_id = p.id
      left join weekly_stats ws on ws.product_id = p.id
      left join seasonality s on s.product_id = p.id
      where p.active
    ),
    stats as (
      select b.*,
        b.qty_52w / b.history_weeks as weekly_mean,
        case when b.qty_52w > 0 then
          sqrt(greatest(0, b.qty_sq_52w / b.history_weeks - power(b.qty_52w / b.history_weeks, 2)))
            / (b.qty_52w / b.history_weeks)
        end as weekly_cv,
        sum(greatest(b.margin_12m, 0)) over () as total_margin,
        sum(greatest(b.margin_12m, 0)) over (order by b.margin_12m desc, b.sku rows between unbounded preceding and current row)
          - greatest(b.margin_12m, 0) as margin_before
      from base b
    ),
    classified as (
      select st.*,
        case
          when st.margin_12m <= 0 or st.total_margin = 0 then 'C'
          when st.margin_before / st.total_margin < 0.80 then 'A'
          when st.margin_before / st.total_margin < 0.95 then 'B'
          else 'C'
        end as abc_class,
        case
          when st.weekly_cv is null or st.history_weeks < 8 then 'Z'
          when st.weekly_cv < 0.5 then 'X'
          when st.weekly_cv <= 1.0 then 'Y'
          else 'Z'
        end as xyz_class
      from stats st
    )
  select
    c.product_id,
    round(c.revenue_12m) as revenue_12m,
    round(c.margin_12m) as margin_12m,
    case when c.total_margin > 0 then round(greatest(c.margin_12m, 0) / c.total_margin, 5) else 0 end as margin_share,
    c.abc_class,
    round(c.weekly_mean, 2) as weekly_mean,
    round(c.weekly_cv, 3) as weekly_cv,
    c.history_weeks,
    c.xyz_class,
    round(c.seasonality_weight, 3) as seasonality_weight,
    c.peak_month
  from classified c;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke execute on function public.refresh_product_classifications() from public, anon;
grant execute on function public.refresh_product_classifications() to authenticated;

-- ─── Vista que lee la app ────────────────────────────────────────────────────

create view public.product_abc_xyz
with (security_invoker = true) as
select
  c.product_id,
  p.sku,
  p.name,
  p.category,
  p.storage_zone,
  p.unit,
  c.revenue_12m,
  c.margin_12m,
  c.margin_share,
  c.abc_class,
  c.weekly_mean,
  c.weekly_cv,
  c.history_weeks,
  c.xyz_class,
  c.seasonality_weight,
  c.peak_month,
  c.computed_at,
  pol.service_level,
  pol.review_days
from public.product_classifications c
join public.products p on p.id = c.product_id
join public.inventory_policies pol on pol.abc_class = c.abc_class and pol.xyz_class = c.xyz_class;

revoke all on public.product_abc_xyz from anon;
grant select on public.product_abc_xyz to authenticated;

-- Primer cálculo
select public.refresh_product_classifications();
