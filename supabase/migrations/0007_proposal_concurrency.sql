-- 0007 · Evita condiciones de carrera en la propuesta de compra.
-- · Aprobar bloquea la fila de la propuesta (FOR UPDATE) antes de revisar su estado: dos aprobaciones
--   simultáneas ya no duplican los pedidos en camino.
-- · Cada decisión de línea bloquea la propuesta en modo compartido y revisa que siga en borrador:
--   no se puede cambiar una línea mientras se aprueba ni después.
-- · Solo puede existir una propuesta en borrador (índice único): dos generaciones simultáneas
--   no dejan dos borradores; la segunda falla y basta con recargar.

create or replace function public.validate_line_decision()
returns trigger
language plpgsql
security definer -- para leer y bloquear la propuesta sin depender de las políticas de update
set search_path = ''
as $$
declare
  proposal_status text;
begin
  select p.status into proposal_status
  from public.purchase_proposals p
  where p.id = new.proposal_id
  for share;

  if proposal_status is distinct from 'borrador' then
    raise exception 'La propuesta ya fue aprobada: no se pueden cambiar sus líneas' using errcode = 'P0001';
  end if;

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
revoke execute on function public.validate_line_decision() from public, anon, authenticated;

create or replace function public.approve_purchase_proposal(p_proposal_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_status text;
  orders integer;
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'compras') then
    raise exception 'Solo admin y compras pueden aprobar la propuesta' using errcode = '42501';
  end if;

  -- Bloquea la propuesta: una segunda aprobación simultánea espera y luego ve que ya está aprobada
  select status into proposal_status
  from public.purchase_proposals
  where id = p_proposal_id
  for update;

  if proposal_status is distinct from 'borrador' then
    raise exception 'La propuesta no existe o ya fue aprobada' using errcode = 'P0001';
  end if;

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

create unique index if not exists purchase_proposals_single_draft_uidx
  on public.purchase_proposals ((true))
  where status = 'borrador';

-- Un pedido en camino nace una sola vez por línea de propuesta
create unique index if not exists incoming_orders_proposal_line_uidx
  on public.incoming_orders (proposal_line_id)
  where proposal_line_id is not null;
