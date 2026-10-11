-- 0008 · Alertas de abastecimiento.
--
-- Cuatro tipos, cada una con gravedad, explicación y acción sugerida:
--   · quiebre_inminente: stock + en camino no cubre la reposición + revisión al ritmo del forecast (próx. 4 semanas).
--       Crítica: clase A que se acaba antes de que llegue un pedido hecho hoy.
--       Alta: clase A dentro de reposición + revisión, o clase B antes de la reposición.
--       Media: clase B dentro de reposición + revisión, o clase C antes de la reposición. C-Z no alerta (bajo pedido).
--   · sobrestock: supera su cobertura objetivo con exceso ≥ $1 M (alta desde $5 M).
--   · sin_movimiento: sin ventas en 90 días o más (alta desde $1 M parado).
--   · ocupacion: bodega o patio ≥ 85% (crítica ≥ 95%), o la propuesta en borrador no cabe.
-- Las alertas se guardan calculadas (refresh_alerts). Compras puede marcarlas como revisadas: quedan ocultas 14 días.

-- ─── Alertas calculadas ──────────────────────────────────────────────────────

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique, -- tipo + producto o zona: identifica la misma alerta entre recálculos
  alert_type text not null check (alert_type in ('quiebre_inminente', 'sobrestock', 'sin_movimiento', 'ocupacion')),
  severity text not null check (severity in ('critica', 'alta', 'media')),
  product_id uuid references public.products (id) on delete cascade,
  storage_zone text,
  title text not null,
  detail text not null,
  action text not null,
  metric numeric, -- días de cobertura, % de ocupación, etc.
  value_clp numeric, -- plata involucrada (exceso, stock parado o venta en riesgo)
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.alerts enable row level security;

create policy "alerts: lectura para usuarios con rol" on public.alerts
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));
-- Sin políticas de escritura: solo refresh_alerts() escribe.

-- ─── Revisiones (compras marca una alerta como revisada) ─────────────────────

create table public.alert_reviews (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  note text check (char_length(note) <= 300),
  reviewed_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.alert_reviews enable row level security;
create index alert_reviews_key_idx on public.alert_reviews (alert_key, reviewed_at desc);

create policy "alert_reviews: lectura para usuarios con rol" on public.alert_reviews
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

-- Solo a nombre propio: nadie registra revisiones por otro usuario
create policy "alert_reviews: compras y admin registran a su nombre" on public.alert_reviews
  for insert to authenticated
  with check (
    (select public.current_user_role()) in ('admin', 'compras')
    and reviewed_by = (select auth.uid())
  );

create policy "alert_reviews: cada uno deshace sus revisiones" on public.alert_reviews
  for delete to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'compras')
    and reviewed_by = (select auth.uid())
  );

revoke update on public.alert_reviews from authenticated;

-- ─── Formato de textos (números a la chilena y unidades en plural) ───────────

create schema if not exists private;

create or replace function private.fmt_num(p_value numeric, p_decimals integer default 0)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    to_char(round(p_value, p_decimals), case when p_decimals > 0 then 'FM999,999,999,990.' || repeat('0', p_decimals) else 'FM999,999,999,990' end),
    ',.', '.,'
  )
$$;

create or replace function private.plural_unit(p_qty numeric, p_unit text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when round(p_qty) = 1 or p_unit ~ '(\d|²|³|kg)$' then p_unit
    when p_unit ~ 'ón$' then left(p_unit, -2) || 'ones'
    when p_unit ~ '[aeiou]$' then p_unit || 's'
    else p_unit || 'es'
  end
$$;

revoke execute on all functions in schema private from public, anon, authenticated;

-- ─── Recalcular ──────────────────────────────────────────────────────────────

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
revoke execute on function public.refresh_alerts() from public, anon;
grant execute on function public.refresh_alerts() to authenticated;

-- ─── Vista que lee la app ────────────────────────────────────────────────────

create view public.alerts_overview
with (security_invoker = true) as
select
  a.*,
  p.sku,
  r.reviewed_at,
  r.note as review_note,
  r.reviewed_by,
  r.id as review_id,
  r.reviewed_at is not null as reviewed
from public.alerts a
left join public.products p on p.id = a.product_id
left join lateral (
  select ar.id, ar.reviewed_at, ar.note, ar.reviewed_by
  from public.alert_reviews ar
  where ar.alert_key = a.alert_key
    and ar.reviewed_at > now() - interval '14 days'
  order by ar.reviewed_at desc
  limit 1
) r on true;

revoke all on public.alerts_overview from anon;
grant select on public.alerts_overview to authenticated;

-- Primer cálculo
select public.refresh_alerts();
