-- 0012 · Endurece la integración de 0008, 0010 y 0011.
-- · Recalcular a la vez: todas las funciones que borran y vuelven a llenar una tabla calculada toman el
--   mismo candado (pg_advisory_xact_lock). Un segundo recálculo simultáneo espera en vez de fallar con
--   "duplicate key". El candado es reentrante: refresh_inventory_metrics llama a las demás sin bloquearse.
-- · Último administrador: un trigger en profiles impide dejar el sistema sin admin, también si se
--   edita el perfil directo por la API (antes solo lo cuidaba set_user_role).
-- Las funciones se copian sin cambios desde su migración de origen; solo se agrega el candado.

-- refresh_stock_status (de 0010_stock_status_stored.sql) + candado
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

  -- Un recálculo a la vez: si otro está corriendo, espera a que termine (evita choques de duplicados)
  perform pg_advisory_xact_lock(hashtext('dimasa_refresh'));

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

-- refresh_product_classifications (de 0004_abc_xyz_stored.sql) + candado
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

  -- Un recálculo a la vez: si otro está corriendo, espera a que termine (evita choques de duplicados)
  perform pg_advisory_xact_lock(hashtext('dimasa_refresh'));

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

-- refresh_forecasts (de 0005_forecast.sql) + candado
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

  -- Un recálculo a la vez: si otro está corriendo, espera a que termine (evita choques de duplicados)
  perform pg_advisory_xact_lock(hashtext('dimasa_refresh'));

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

-- refresh_alerts (de 0008_alerts.sql) + candado
create or replace function public.refresh_alerts()
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
    raise exception 'Solo admin y compras pueden recalcular las alertas' using errcode = '42501';
  end if;

  -- Un recálculo a la vez: si otro está corriendo, espera a que termine (evita choques de duplicados)
  perform pg_advisory_xact_lock(hashtext('dimasa_refresh'));

  delete from public.alerts where true;

  insert into public.alerts (alert_key, alert_type, severity, product_id, storage_zone, title, detail, action, metric, value_clp)
  -- Quiebre inminente
  with demand as (
    select f.product_id, sum(f.forecast_qty) / 28.0 as daily_qty
    from public.product_forecasts f
    where f.horizon_week <= 4
    group by f.product_id
  ),
  transit as (
    select o.product_id, sum(o.quantity) as qty
    from public.incoming_orders o
    where o.status = 'en_camino'
    group by o.product_id
  ),
  supply as (
    select s.product_id, s.name, s.unit, s.stock_qty, s.lead_time_days, s.origin,
      p.unit_price, c.abc_class, c.xyz_class, pol.review_days,
      coalesce(t.qty, 0) as in_transit,
      d.daily_qty,
      (s.stock_qty + coalesce(t.qty, 0)) / d.daily_qty as cover_days
    from public.product_stock_status s
    join public.products p on p.id = s.product_id
    join public.product_classifications c on c.product_id = s.product_id
    join public.inventory_policies pol on pol.abc_class = c.abc_class and pol.xyz_class = c.xyz_class
    join demand d on d.product_id = s.product_id and d.daily_qty > 0
    left join transit t on t.product_id = s.product_id
    where pol.service_level is not null
  ),
  stockout as (
    select su.*,
      case
        when su.abc_class = 'A' and su.cover_days < su.lead_time_days then 'critica'
        when su.abc_class = 'A' and su.cover_days < su.lead_time_days + su.review_days then 'alta'
        when su.abc_class = 'B' and su.cover_days < su.lead_time_days then 'alta'
        when su.abc_class = 'B' and su.cover_days < su.lead_time_days + su.review_days then 'media'
        when su.abc_class = 'C' and su.cover_days < su.lead_time_days then 'media'
      end as severity
    from supply su
  )
  select 'quiebre_inminente:' || so.product_id, 'quiebre_inminente', so.severity, so.product_id, null,
    case when so.stock_qty = 0 then so.name || ' está sin stock'
         else so.name || ' se queda sin stock en ~' || floor(so.cover_days)::int || ' días' end,
    'Stock ' || private.fmt_num(so.stock_qty) || ' + ' || private.fmt_num(so.in_transit) || ' en camino alcanzan para '
      || private.fmt_num(so.cover_days, 1) || ' días al ritmo proyectado (' || private.fmt_num(so.daily_qty * 7) || ' '
      || private.plural_unit(so.daily_qty * 7, so.unit) || ' por semana). Reposición: ' || so.lead_time_days
      || ' días; clase ' || so.abc_class || '-' || so.xyz_class || '.',
    case
      when so.severity = 'critica' and so.origin = 'importado'
        then 'Un pedido importado no llega a tiempo: evaluar compra puntual a un proveedor nacional.'
      when so.severity = 'critica' then 'Pedir hoy, fuera del ciclo semanal.'
      else 'Revisar que esté en la propuesta de compra de esta semana.'
    end,
    round(so.cover_days, 1),
    round(greatest(0, so.lead_time_days - so.cover_days) * so.daily_qty * so.unit_price)
  from stockout so
  where so.severity is not null

  union all
  -- Sobrestock
  select 'sobrestock:' || s.product_id, 'sobrestock',
    case when s.excess_value >= 5000000 then 'alta' else 'media' end,
    s.product_id, null,
    s.name || ': ' || private.fmt_num(s.coverage_days) || ' días de stock (objetivo ' || s.target_cover_days || ')',
    'El exceso sobre la cobertura objetivo vale $' || private.fmt_num(s.excess_value) || ' a costo.',
    case when c.abc_class = 'C' then 'No reponer y liquidar con promoción.'
         else 'Pausar compras hasta volver a la cobertura objetivo; evaluar promoción.' end,
    round(s.coverage_days, 1),
    round(s.excess_value)
  from public.product_stock_status s
  left join public.product_classifications c on c.product_id = s.product_id
  where s.status = 'sobrestock' and s.excess_value >= 1000000

  union all
  -- Sin movimiento
  select 'sin_movimiento:' || s.product_id, 'sin_movimiento',
    case when s.stock_value >= 1000000 then 'alta' else 'media' end,
    s.product_id, null,
    s.name || coalesce(' no se vende hace ' || s.days_since_last_sale || ' días', ': sin ventas registradas'),
    'Hay ' || private.fmt_num(s.stock_qty) || ' ' || private.plural_unit(s.stock_qty, s.unit) || ' sin vender por $'
      || private.fmt_num(s.stock_value) || ' a costo.',
    'Liquidar con promoción, devolver al proveedor o descontinuar.',
    s.days_since_last_sale,
    round(s.stock_value)
  from public.product_stock_status s
  where s.status = 'sin_movimiento'

  union all
  -- Ocupación de bodega y patio
  select 'ocupacion:' || z.code, 'ocupacion',
    case when o.ratio >= 0.95 then 'critica' else 'alta' end,
    null, z.code,
    z.name || ' al ' || round(o.ratio * 100) || '% de su capacidad',
    'Ocupados ' || private.fmt_num(o.used) || ' de ' || private.fmt_num(z.capacity_m2) || ' m²; quedan '
      || private.fmt_num(greatest(0, z.capacity_m2 - o.used)) || ' m² libres.',
    'Priorizar liquidar sobrestock y stock sin movimiento de esta zona antes de recibir compras.',
    round(o.ratio * 100, 1),
    null
  from public.storage_zones z
  join (
    select s.storage_zone, sum(s.occupied_m2) as used
    from public.product_stock_status s
    group by s.storage_zone
  ) o0 on o0.storage_zone = z.code
  cross join lateral (select o0.used, o0.used / z.capacity_m2 as ratio) o
  where o.ratio >= 0.85

  union all
  -- La propuesta en borrador no cabe
  select 'ocupacion_propuesta:' || l.storage_zone, 'ocupacion', 'alta', null, l.storage_zone,
    'La propuesta de compra no cabe en ' || case l.storage_zone when 'patio' then 'el patio' else 'la bodega techada' end,
    'Lo propuesto ocupa ' || private.fmt_num(sum(l.final_qty * l.m2_per_unit)) || ' m² y quedan '
      || private.fmt_num(case l.storage_zone when 'patio' then max(pp.free_m2_patio) else max(pp.free_m2_bodega) end) || ' m² libres.',
    'Ajustar o rechazar líneas B y C de esa zona antes de aprobar.',
    round(sum(l.final_qty * l.m2_per_unit)),
    null
  from public.purchase_proposal_lines l
  join public.purchase_proposals pp on pp.id = l.proposal_id and pp.status = 'borrador'
  group by l.storage_zone
  having sum(l.final_qty * l.m2_per_unit)
    > case l.storage_zone when 'patio' then max(pp.free_m2_patio) else max(pp.free_m2_bodega) end;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- generate_purchase_proposal (de 0006_purchase_proposal.sql) + candado
create or replace function public.generate_purchase_proposal()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_date date;
  new_id uuid;
  free_bodega numeric;
  free_patio numeric;
  skipped integer;
begin
  if (select auth.uid()) is not null
     and coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden generar la propuesta' using errcode = '42501';
  end if;

  -- Un recálculo a la vez: si otro está corriendo, espera a que termine (evita choques de duplicados)
  perform pg_advisory_xact_lock(hashtext('dimasa_refresh'));

  select max(snapshot_date) into ref_date from public.inventory_snapshots;
  if ref_date is null
     or not exists (select 1 from public.product_classifications)
     or not exists (select 1 from public.product_forecasts) then
    raise exception 'Primero calcula la matriz ABC-XYZ y el forecast' using errcode = 'P0001';
  end if;

  -- Superficie libre hoy por zona
  select
    coalesce(max(z.capacity_m2 - o.used) filter (where z.code = 'bodega'), 0),
    coalesce(max(z.capacity_m2 - o.used) filter (where z.code = 'patio'), 0)
  into free_bodega, free_patio
  from public.storage_zones z
  left join (
    select p.storage_zone, sum(i.quantity * p.m2_per_unit) as used
    from public.inventory_snapshots i
    join public.products p on p.id = i.product_id
    where i.snapshot_date = ref_date
    group by p.storage_zone
  ) o on o.storage_zone = z.code;

  select count(*) into skipped
  from public.product_classifications c
  where c.abc_class = 'C' and c.xyz_class = 'Z';

  -- Se reemplaza el borrador anterior; las aprobadas quedan como historial
  delete from public.purchase_proposals where status = 'borrador';

  insert into public.purchase_proposals (origin_date, generated_by, free_m2_bodega, free_m2_patio, on_demand_skipped)
  values (ref_date, (select auth.uid()), greatest(free_bodega, 0), greatest(free_patio, 0), skipped)
  returning id into new_id;

  insert into public.purchase_proposal_lines (
    proposal_id, product_id, supplier_id, abc_class, xyz_class, service_level, z_score, lead_time_days,
    review_days, cover_weeks, demand_qty, sigma_week, safety_stock, stock_qty, in_transit_qty, raw_qty,
    lot_size, min_order_qty, suggested_qty, capacity_cut, unit_cost, m2_per_unit, storage_zone, final_qty
  )
  with base as (
    select
      p.id as product_id, p.supplier_id, p.storage_zone, p.unit_cost, p.m2_per_unit, p.lot_size, p.min_order_qty,
      c.abc_class, c.xyz_class, c.margin_12m,
      pol.service_level, pol.review_days, s.lead_time_days,
      case
        when pol.service_level >= 0.98 then 2.05
        when pol.service_level >= 0.97 then 1.88
        when pol.service_level >= 0.95 then 1.64
        when pol.service_level >= 0.93 then 1.48
        when pol.service_level >= 0.90 then 1.28
        else 1.04
      end as z_score,
      (s.lead_time_days + pol.review_days) / 7.0 as cover_weeks,
      m.sigma_week,
      coalesce(st.quantity, 0) as stock_qty,
      coalesce(io.qty, 0) as in_transit_qty
    from public.products p
    join public.suppliers s on s.id = p.supplier_id
    join public.product_classifications c on c.product_id = p.id
    join public.inventory_policies pol on pol.abc_class = c.abc_class and pol.xyz_class = c.xyz_class
    join public.product_forecast_metrics m on m.product_id = p.id
    left join public.inventory_snapshots st on st.product_id = p.id and st.snapshot_date = ref_date
    left join (
      select o.product_id, sum(o.quantity) as qty
      from public.incoming_orders o
      where o.status = 'en_camino'
      group by o.product_id
    ) io on io.product_id = p.id
    where p.active and pol.service_level is not null
  ),
  demand as (
    select b.product_id,
      sum(f.forecast_qty * least(1, greatest(0, b.cover_weeks - (f.horizon_week - 1)))) as demand_qty
    from base b
    join public.product_forecasts f on f.product_id = b.product_id
    group by b.product_id
  ),
  calc as (
    select b.*,
      round(coalesce(d.demand_qty, 0), 1) as demand_qty,
      round(b.z_score * b.sigma_week * sqrt(b.cover_weeks), 1) as safety_stock
    from base b
    left join demand d on d.product_id = b.product_id
  ),
  sized as (
    select c.*,
      greatest(0, c.demand_qty + c.safety_stock - c.stock_qty - c.in_transit_qty) as raw_qty,
      case
        when c.demand_qty + c.safety_stock - c.stock_qty - c.in_transit_qty <= 0 then 0
        else greatest(
          c.min_order_qty,
          ceil((c.demand_qty + c.safety_stock - c.stock_qty - c.in_transit_qty) / c.lot_size) * c.lot_size
        )
      end as order_qty
    from calc c
  ),
  -- Capacidad: A siempre entra; B y C entran en orden de margen mientras quede espacio en su zona
  fitted as (
    select s.*,
      sum(case when s.abc_class = 'A' then 0 else s.order_qty * s.m2_per_unit end) over (
        partition by s.storage_zone
        order by s.abc_class, s.margin_12m desc, s.product_id
        rows between unbounded preceding and current row
      ) + sum(case when s.abc_class = 'A' then s.order_qty * s.m2_per_unit else 0 end) over (partition by s.storage_zone)
        as cumulative_m2
    from sized s
    where s.order_qty > 0
  )
  select new_id, f.product_id, f.supplier_id, f.abc_class, f.xyz_class, f.service_level, f.z_score, f.lead_time_days,
    f.review_days, round(f.cover_weeks, 2), f.demand_qty, f.sigma_week, f.safety_stock, f.stock_qty, f.in_transit_qty,
    round(f.raw_qty, 1), f.lot_size, f.min_order_qty,
    case when cut.is_cut then 0 else f.order_qty end,
    cut.is_cut,
    f.unit_cost, f.m2_per_unit, f.storage_zone,
    case when cut.is_cut then 0 else f.order_qty end
  from fitted f
  cross join lateral (
    select f.abc_class <> 'A'
      and f.cumulative_m2 > case f.storage_zone when 'bodega' then free_bodega else free_patio end as is_cut
  ) cut;

  return new_id;
end;
$$;

-- refresh_inventory_metrics (de 0010_stock_status_stored.sql) + candado
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

  -- Un recálculo a la vez: si otro está corriendo, espera a que termine (evita choques de duplicados)
  perform pg_advisory_xact_lock(hashtext('dimasa_refresh'));

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

-- ─── Nunca sin administrador ─────────────────────────────────────────────────

create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    -- Bloquea los admins para que dos cambios simultáneos no los quiten a todos
    perform 1 from public.profiles where role = 'admin' for update;
    if (select count(*) from public.profiles where role = 'admin' and user_id <> old.user_id) = 0 then
      raise exception 'No se puede quitar el rol al último administrador' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.prevent_last_admin_removal() from public, anon, authenticated;

create trigger profiles_keep_one_admin
  before update of role on public.profiles
  for each row execute function public.prevent_last_admin_removal();
