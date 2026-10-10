-- 0002 · Matriz ABC-XYZ: políticas de compra por celda y clasificación de cada producto.
-- ABC = margen de los últimos 12 meses (A: 80% acumulado, B: siguiente 15%, C: resto).
-- XYZ = variación de la venta semanal en las últimas 52 semanas (X < 0,5, Y hasta 1,0, Z > 1,0).
-- Peso de estacionalidad = amplitud del índice mensual (0 = plano, 1 = muy estacional).

-- ─── Políticas por celda ─────────────────────────────────────────────────────

create table public.inventory_policies (
  id uuid primary key default gen_random_uuid(),
  abc_class text not null check (abc_class in ('A', 'B', 'C')),
  xyz_class text not null check (xyz_class in ('X', 'Y', 'Z')),
  service_level numeric check (service_level > 0 and service_level < 1), -- null = bajo pedido
  review_days integer not null check (review_days > 0),
  description text not null,
  created_at timestamptz not null default now(),
  unique (abc_class, xyz_class)
);
alter table public.inventory_policies enable row level security;

create policy "inventory_policies: lectura para usuarios con rol" on public.inventory_policies
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

create policy "inventory_policies: compras y admin actualizan" on public.inventory_policies
  for update to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras'))
  with check ((select public.current_user_role()) in ('admin', 'compras'));

create policy "inventory_policies: solo admin inserta" on public.inventory_policies
  for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "inventory_policies: solo admin borra" on public.inventory_policies
  for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

insert into public.inventory_policies (abc_class, xyz_class, service_level, review_days, description) values
  ('A', 'X', 0.98, 7, 'Reposición semanal casi automática. Nunca puede faltar: sostiene el despacho en 24 a 48 horas.'),
  ('A', 'Y', 0.97, 7, 'Revisión semanal con forecast que considere estacionalidad y promociones.'),
  ('A', 'Z', 0.95, 7, 'Revisión semanal con criterio humano; en constructoras, mirar las obras en curso.'),
  ('B', 'X', 0.95, 14, 'Reposición quincenal con nivel de servicio alto.'),
  ('B', 'Y', 0.93, 14, 'Reposición quincenal con nivel de servicio medio.'),
  ('B', 'Z', 0.90, 14, 'Revisión quincenal con criterio humano antes de comprar.'),
  ('C', 'X', 0.90, 30, 'Compra mensual por lote económico.'),
  ('C', 'Y', 0.85, 30, 'Compra mensual con nivel de servicio bajo.'),
  ('C', 'Z', null, 30, 'Bajo pedido. Candidato a liquidar con promoción o a descontinuar.');

-- ─── Clasificación por producto ──────────────────────────────────────────────

create view public.product_abc_xyz
with (security_invoker = true) as
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
monthly as (
  select p.id as product_id, m.month_start, coalesce(sum(sa.quantity), 0) as qty
  from public.products p
  cross join months m
  left join public.sales sa
    on sa.product_id = p.id
   and sa.sale_date >= m.month_start
   and sa.sale_date < m.month_start + interval '1 month'
  group by p.id, m.month_start
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
    (array_agg(month_num order by avg_qty desc))[1] as peak_month
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
  c.sku,
  c.name,
  c.category,
  c.storage_zone,
  c.unit,
  round(c.revenue_12m) as revenue_12m,
  round(c.margin_12m) as margin_12m,
  case when c.total_margin > 0 then round(greatest(c.margin_12m, 0) / c.total_margin, 5) else 0 end as margin_share,
  c.abc_class,
  round(c.weekly_mean, 2) as weekly_mean,
  round(c.weekly_cv, 3) as weekly_cv,
  c.history_weeks,
  c.xyz_class,
  round(c.seasonality_weight, 3) as seasonality_weight,
  c.peak_month,
  pol.service_level,
  pol.review_days,
  st.stock_value,
  st.excess_value,
  st.coverage_days,
  st.status
from classified c
join public.inventory_policies pol on pol.abc_class = c.abc_class and pol.xyz_class = c.xyz_class
left join public.product_stock_status st on st.product_id = c.product_id;

revoke all on public.product_abc_xyz from anon;
grant select on public.product_abc_xyz to authenticated;
