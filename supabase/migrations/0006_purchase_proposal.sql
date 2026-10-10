-- 0006 · Propuesta de compra semanal.
--
-- Cantidad sugerida por producto (fórmula de la propuesta, revisión periódica):
--   W  = (plazo de reposición + período de revisión) en semanas
--   D  = demanda proyectada en esas W semanas (forecast, prorrateando la última semana)
--   SS = z(nivel de servicio de la celda ABC-XYZ) × error típico semanal × √W
--   Q  = máx(0, D + SS − stock − en camino), redondeado al lote del proveedor y al mínimo de compra
-- C-Z no se repone (bajo pedido). Si lo propuesto no cabe en bodega o patio, se recorta C y luego B; A nunca.
-- Compras aprueba, ajusta o rechaza cada línea; al aprobar la propuesta, lo pedido queda "en camino".

-- ─── Pedidos en camino ───────────────────────────────────────────────────────

create table public.incoming_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  ordered_at date not null default current_date,
  expected_date date not null,
  status text not null default 'en_camino' check (status in ('en_camino', 'recibida', 'cancelada')),
  proposal_line_id uuid, -- línea de propuesta que lo originó (si aplica)
  created_at timestamptz not null default now()
);
alter table public.incoming_orders enable row level security;
create index incoming_orders_product_idx on public.incoming_orders (product_id) where status = 'en_camino';

create policy "incoming_orders: lectura para usuarios con rol" on public.incoming_orders
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));
create policy "incoming_orders: compras y admin insertan" on public.incoming_orders
  for insert to authenticated
  with check ((select public.current_user_role()) in ('admin', 'compras'));
create policy "incoming_orders: compras y admin actualizan" on public.incoming_orders
  for update to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras'))
  with check ((select public.current_user_role()) in ('admin', 'compras'));

-- ─── Propuestas ──────────────────────────────────────────────────────────────

create table public.purchase_proposals (
  id uuid primary key default gen_random_uuid(),
  origin_date date not null, -- fecha de los datos con que se calculó
  status text not null default 'borrador' check (status in ('borrador', 'aprobada')),
  generated_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  free_m2_bodega numeric not null,
  free_m2_patio numeric not null,
  on_demand_skipped integer not null default 0, -- productos C-Z que no se reponen
  created_at timestamptz not null default now()
);
alter table public.purchase_proposals enable row level security;

create policy "purchase_proposals: lectura para usuarios con rol" on public.purchase_proposals
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));
-- Sin políticas de escritura: solo las funciones de abajo crean y aprueban propuestas.

create table public.purchase_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.purchase_proposals (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  abc_class text not null,
  xyz_class text not null,
  service_level numeric not null,
  z_score numeric not null,
  lead_time_days integer not null,
  review_days integer not null,
  cover_weeks numeric not null,
  demand_qty numeric not null,
  sigma_week numeric not null,
  safety_stock numeric not null,
  stock_qty numeric not null,
  in_transit_qty numeric not null,
  raw_qty numeric not null,
  lot_size integer not null,
  min_order_qty integer not null,
  suggested_qty numeric not null,
  capacity_cut boolean not null default false,
  unit_cost numeric not null,
  m2_per_unit numeric not null,
  storage_zone text not null,
  final_qty numeric not null check (final_qty >= 0),
  decision text not null default 'pendiente' check (decision in ('pendiente', 'aprobada', 'ajustada', 'rechazada')),
  decision_reason text check (char_length(decision_reason) <= 500),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (proposal_id, product_id)
);
alter table public.purchase_proposal_lines enable row level security;
create index purchase_proposal_lines_proposal_idx on public.purchase_proposal_lines (proposal_id);

create policy "purchase_proposal_lines: lectura para usuarios con rol" on public.purchase_proposal_lines
  for select to authenticated
  using ((select public.current_user_role()) in ('admin', 'compras', 'gerencia'));

-- Compras y admin deciden, solo en propuestas en borrador y solo en las columnas de decisión
create policy "purchase_proposal_lines: compras y admin deciden en borradores" on public.purchase_proposal_lines
  for update to authenticated
  using (
    (select public.current_user_role()) in ('admin', 'compras')
    and proposal_id = any (array(select p.id from public.purchase_proposals p where p.status = 'borrador'))
  )
  with check (
    (select public.current_user_role()) in ('admin', 'compras')
    and proposal_id = any (array(select p.id from public.purchase_proposals p where p.status = 'borrador'))
  );
revoke update on public.purchase_proposal_lines from authenticated;
grant update (final_qty, decision, decision_reason) on public.purchase_proposal_lines to authenticated;

-- Valida la decisión y registra quién y cuándo
create or replace function public.validate_line_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.decision_reason := nullif(btrim(new.decision_reason), '');
  if new.decision = 'aprobada' then
    new.final_qty := new.suggested_qty;
  elsif new.decision = 'rechazada' then
    new.final_qty := 0;
    if new.decision_reason is null then
      raise exception 'Indica el motivo del rechazo' using errcode = '23514';
    end if;
  elsif new.decision = 'ajustada' then
    if new.decision_reason is null then
      raise exception 'Indica el motivo del ajuste' using errcode = '23514';
    end if;
  elsif new.decision = 'pendiente' then
    new.final_qty := new.suggested_qty;
    new.decision_reason := null;
  end if;
  new.decided_by := (select auth.uid());
  new.decided_at := now();
  return new;
end;
$$;

create trigger purchase_proposal_lines_decision
  before update on public.purchase_proposal_lines
  for each row execute function public.validate_line_decision();

-- ─── Generar propuesta ───────────────────────────────────────────────────────

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
revoke execute on function public.generate_purchase_proposal() from public, anon;
grant execute on function public.generate_purchase_proposal() to authenticated;

-- ─── Aprobar propuesta ───────────────────────────────────────────────────────

create or replace function public.approve_purchase_proposal(p_proposal_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  orders integer;
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden aprobar la propuesta' using errcode = '42501';
  end if;

  if not exists (select 1 from public.purchase_proposals where id = p_proposal_id and status = 'borrador') then
    raise exception 'La propuesta no existe o ya fue aprobada' using errcode = 'P0001';
  end if;

  -- Lo que quedó pendiente se aprueba tal como se sugirió
  update public.purchase_proposal_lines
  set decision = 'aprobada'
  where proposal_id = p_proposal_id and decision = 'pendiente';

  update public.purchase_proposals
  set status = 'aprobada', approved_by = (select auth.uid()), approved_at = now()
  where id = p_proposal_id;

  insert into public.incoming_orders (product_id, quantity, ordered_at, expected_date, proposal_line_id)
  select l.product_id, l.final_qty, current_date, current_date + l.lead_time_days, l.id
  from public.purchase_proposal_lines l
  where l.proposal_id = p_proposal_id and l.final_qty > 0;

  get diagnostics orders = row_count;
  return orders;
end;
$$;
revoke execute on function public.approve_purchase_proposal(uuid) from public, anon;
grant execute on function public.approve_purchase_proposal(uuid) to authenticated;

-- ─── Vista que lee la app ────────────────────────────────────────────────────

create view public.purchase_proposal_detail
with (security_invoker = true) as
select
  l.*,
  p.sku,
  p.name,
  p.category,
  p.unit,
  s.name as supplier_name,
  s.origin
from public.purchase_proposal_lines l
join public.products p on p.id = l.product_id
join public.suppliers s on s.id = l.supplier_id;

revoke all on public.purchase_proposal_detail from anon;
grant select on public.purchase_proposal_detail to authenticated;
