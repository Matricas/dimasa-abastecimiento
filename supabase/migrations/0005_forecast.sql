-- 0005 · Forecast de demanda semanal por producto, con backtesting contra el método actual.
--
-- Método (explicable en una frase por producto):
--   · Estacional: demanda base = promedio ponderado de las últimas 12 semanas (las recientes pesan más),
--     sin el efecto de temporada; se proyecta multiplicando por el índice del mes de cada semana futura.
--     El índice mezcla 50/50 el patrón del producto y el de su categoría, para no copiar ruido.
--   · Esporádico (más del 40% de las últimas 26 semanas sin venta): promedio simple de 26 semanas.
--   · Sin venta en 26 semanas: 0.
-- Horizonte: 12 semanas nacional, 17 semanas (~4 meses) importado.
-- Rango bajo/alto: ± 1,28 × error típico semanal del backtest (aprox. 80% de las semanas dentro).
-- Backtest: se proyectan las últimas 12 semanas como si fuera hace 12 semanas y se compara con lo real,
-- contra dos métodos de referencia: "misma semana del año pasado" y "promedio de las 4 semanas previas".
-- Igual que la matriz, se guarda calculado (no se calcula en cada visita).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ─── Proyección desde una fecha de origen ────────────────────────────────────

create or replace function private.forecast_weekly(p_origin date, p_horizon integer)
returns table (product_id uuid, method text, weekly_level numeric, horizon_week integer, week_start date, forecast_qty numeric)
language sql
stable
set search_path = ''
as $$
  with products as (
    select p.id, p.category from public.products p where p.active
  ),
  -- semana k = 7 días que terminan en (p_origin - 7k)
  weekly as (
    select sa.product_id, (p_origin - sa.sale_date) / 7 as k, sum(sa.quantity) as qty
    from public.sales sa
    where sa.sale_date > p_origin - 182 and sa.sale_date <= p_origin
    group by sa.product_id, k
  ),
  first_sale as (
    select sa.product_id, min(sa.sale_date) as first_date
    from public.sales sa
    where sa.sale_date <= p_origin
    group by sa.product_id
  ),
  -- índice mensual: promedio de cada mes calendario en los meses completos con datos (hasta 24),
  -- dividido por el promedio de los 12 meses. Se promedia (no se suma) porque no todos los meses
  -- aparecen la misma cantidad de veces en la historia.
  data_start as (
    select min(sa.sale_date) as d from public.sales sa where sa.sale_date <= p_origin
  ),
  calendar as (
    select gs::date as month_start
    from data_start ds
    cross join generate_series(
      date_trunc('month', greatest(ds.d, p_origin - 730) - 1) + interval '1 month',
      date_trunc('month', p_origin) - interval '1 month',
      interval '1 month'
    ) as gs
  ),
  monthly as (
    select sa.product_id, date_trunc('month', sa.sale_date)::date as month_start, sum(sa.quantity) as qty
    from public.sales sa
    where sa.sale_date >= (select min(month_start) from calendar)
      and sa.sale_date < date_trunc('month', p_origin)::date
    group by sa.product_id, month_start
  ),
  prod_month as (
    select p.id as product_id, p.category, extract(month from c.month_start)::int as m, avg(coalesce(mo.qty, 0)) as qty
    from products p
    cross join calendar c
    left join monthly mo on mo.product_id = p.id and mo.month_start = c.month_start
    group by p.id, p.category, m
  ),
  cat_month as (
    select category, m, sum(qty) as qty from prod_month group by category, m
  ),
  season_index as (
    select pm.product_id, pm.m,
      greatest(0.3, least(3,
        0.5 * coalesce(pm.qty / nullif(avg(pm.qty) over (partition by pm.product_id), 0), 1)
        + 0.5 * coalesce(cm.qty / nullif(avg(cm.qty) over (partition by pm.product_id), 0), 1)
      )) as idx
    from prod_month pm
    join cat_month cm on cm.category = pm.category and cm.m = pm.m
  ),
  recent as (
    select p.id as product_id, kk.k, coalesce(w.qty, 0) as qty,
      extract(month from p_origin - 7 * kk.k - 3)::int as m,
      (p_origin - 7 * kk.k) >= fs.first_date as has_history
    from products p
    cross join generate_series(0, 25) as kk(k)
    left join weekly w on w.product_id = p.id and w.k = kk.k
    left join first_sale fs on fs.product_id = p.id
  ),
  profile as (
    select r.product_id,
      sum(r.qty) filter (where r.has_history) as qty_26w,
      count(*) filter (where r.has_history) as weeks_26w,
      count(*) filter (where r.has_history and r.qty = 0) as zero_weeks_26w,
      sum(power(0.85, r.k) * r.qty / coalesce(si.idx, 1)) filter (where r.k < 12 and r.has_history)
        / nullif(sum(power(0.85, r.k)) filter (where r.k < 12 and r.has_history), 0) as level_12w
    from recent r
    left join season_index si on si.product_id = r.product_id and si.m = r.m
    group by r.product_id
  ),
  methods as (
    select pr.product_id,
      case
        when coalesce(pr.qty_26w, 0) = 0 then 'sin_venta'
        when pr.zero_weeks_26w::numeric / pr.weeks_26w > 0.4 then 'esporadico'
        else 'estacional'
      end as method,
      case
        when coalesce(pr.qty_26w, 0) = 0 then 0
        when pr.zero_weeks_26w::numeric / pr.weeks_26w > 0.4 then pr.qty_26w / pr.weeks_26w
        else coalesce(pr.level_12w, 0)
      end as weekly_level
    from profile pr
  )
  select mt.product_id, mt.method, round(mt.weekly_level, 3), h.h,
    p_origin + 7 * (h.h - 1) + 1 as week_start,
    round(case when mt.method = 'estacional' then mt.weekly_level * coalesce(si.idx, 1) else mt.weekly_level end, 2)
  from methods mt
  cross join generate_series(1, p_horizon) as h(h)
  left join season_index si
    on si.product_id = mt.product_id
   and si.m = extract(month from p_origin + 7 * h.h - 3)::int
$$;
revoke execute on function private.forecast_weekly(date, integer) from public, anon, authenticated;

-- ─── Resultados guardados ────────────────────────────────────────────────────

create table public.product_forecasts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  horizon_week integer not null check (horizon_week > 0),
  week_start date not null,
  forecast_qty numeric not null,
  low_qty numeric not null,
  high_qty numeric not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, week_start)
);
alter table public.product_forecasts enable row level security;

create table public.product_forecast_metrics (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  origin_date date not null,
  method text not null check (method in ('estacional', 'esporadico', 'sin_venta')),
  weekly_level numeric not null,
  backtest_actual_qty numeric not null,
  abs_error_model numeric not null,
  abs_error_last_year numeric not null,
  abs_error_last_4w numeric not null,
  bias_model numeric not null, -- suma de (proyectado - real) en el backtest
  sigma_week numeric not null, -- error típico semanal del backtest
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.product_forecast_metrics enable row level security;

create policy "product_forecasts: lectura para usuarios con rol" on public.product_forecasts
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

create policy "product_forecast_metrics: lectura para usuarios con rol" on public.product_forecast_metrics
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

-- ─── Recalcular ──────────────────────────────────────────────────────────────

create or replace function public.refresh_forecasts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_date date;
  products_done integer;
begin
  if (select auth.uid()) is not null
     and coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden recalcular el forecast' using errcode = '42501';
  end if;

  select max(snapshot_date) into ref_date from public.inventory_snapshots;
  if ref_date is null then
    return 0;
  end if;

  delete from public.product_forecasts where true;
  delete from public.product_forecast_metrics where true;

  -- Backtest: origen hace 12 semanas, se compara con las 12 semanas reales
  with fc as (
    select * from private.forecast_weekly(ref_date - 84, 12)
  ),
  wk as (
    select sa.product_id, (ref_date - sa.sale_date) / 7 as k, sum(sa.quantity) as qty
    from public.sales sa
    where sa.sale_date > ref_date - 7 * 65 and sa.sale_date <= ref_date
    group by sa.product_id, k
  ),
  prev_4w as (
    select product_id, sum(qty) / 4.0 as avg_qty from wk where k between 12 and 15 group by product_id
  ),
  bt as (
    select fc.product_id, fc.horizon_week as h,
      fc.forecast_qty as fc_qty,
      coalesce(a.qty, 0) as actual,
      coalesce(ly.qty, 0) as last_year,
      coalesce(p4.avg_qty, 0) as last_4w
    from fc
    left join wk a on a.product_id = fc.product_id and a.k = 12 - fc.horizon_week
    left join wk ly on ly.product_id = fc.product_id and ly.k = 12 - fc.horizon_week + 52
    left join prev_4w p4 on p4.product_id = fc.product_id
  ),
  bt_summary as (
    select product_id,
      sum(actual) as actual,
      sum(abs(fc_qty - actual)) as err_model,
      sum(abs(last_year - actual)) as err_ly,
      sum(abs(last_4w - actual)) as err_4w,
      sum(fc_qty - actual) as bias,
      sqrt(avg(power(fc_qty - actual, 2))) as sigma
    from bt
    group by product_id
  ),
  current_fc as (
    select distinct on (f.product_id) f.product_id, f.method, f.weekly_level
    from private.forecast_weekly(ref_date, 1) f
  )
  insert into public.product_forecast_metrics (
    product_id, origin_date, method, weekly_level, backtest_actual_qty,
    abs_error_model, abs_error_last_year, abs_error_last_4w, bias_model, sigma_week
  )
  select c.product_id, ref_date, c.method, c.weekly_level, coalesce(b.actual, 0),
    round(coalesce(b.err_model, 0), 2), round(coalesce(b.err_ly, 0), 2), round(coalesce(b.err_4w, 0), 2),
    round(coalesce(b.bias, 0), 2), round(coalesce(b.sigma, 0), 3)
  from current_fc c
  left join bt_summary b on b.product_id = c.product_id;

  get diagnostics products_done = row_count;

  -- Proyección hacia adelante, con horizonte según origen del proveedor
  insert into public.product_forecasts (product_id, horizon_week, week_start, forecast_qty, low_qty, high_qty)
  select f.product_id, f.horizon_week, f.week_start, f.forecast_qty,
    round(greatest(0, f.forecast_qty - 1.28 * m.sigma_week), 2),
    round(f.forecast_qty + 1.28 * m.sigma_week, 2)
  from private.forecast_weekly(ref_date, 17) f
  join public.products p on p.id = f.product_id
  join public.suppliers s on s.id = p.supplier_id
  join public.product_forecast_metrics m on m.product_id = f.product_id
  where f.horizon_week <= case when s.origin = 'importado' then 17 else 12 end;

  return products_done;
end;
$$;
revoke execute on function public.refresh_forecasts() from public, anon;
grant execute on function public.refresh_forecasts() to authenticated;

-- ─── Vista que lee la app ────────────────────────────────────────────────────

create view public.forecast_overview
with (security_invoker = true) as
select
  m.product_id,
  p.sku,
  p.name,
  p.category,
  p.unit,
  s.origin,
  s.lead_time_days,
  c.abc_class,
  c.xyz_class,
  m.origin_date,
  m.method,
  m.weekly_level,
  m.backtest_actual_qty,
  m.abs_error_model,
  m.abs_error_last_year,
  m.abs_error_last_4w,
  m.bias_model,
  m.sigma_week,
  m.computed_at,
  coalesce(sum(f.forecast_qty) filter (where f.horizon_week <= 4), 0) as forecast_4w,
  coalesce(sum(f.forecast_qty), 0) as forecast_horizon,
  count(f.id)::int as horizon_weeks
from public.product_forecast_metrics m
join public.products p on p.id = m.product_id
join public.suppliers s on s.id = p.supplier_id
left join public.product_classifications c on c.product_id = m.product_id
left join public.product_forecasts f on f.product_id = m.product_id
group by m.id, p.id, s.id, c.id;

revoke all on public.forecast_overview from anon;
grant select on public.forecast_overview to authenticated;

-- Primer cálculo
select public.refresh_forecasts();
