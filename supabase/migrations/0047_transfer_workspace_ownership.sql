-- Enables real Owner→Owner transfer for CRM > Agentes' role management
-- (src/lib/settings/actions.ts's updateMemberRole previously rejected
-- role='owner' outright — a workspace could never actually reassign
-- ownership). A workspace must always have exactly one Owner, so the swap
-- (new owner promoted, previous owner demoted to admin) has to happen as a
-- single atomic operation — two sequential plain `.update()` calls through
-- PostgREST could leave the workspace with zero owners if the second one
-- failed. Called via the plain (session) client, not service-role, so
-- auth.uid() resolves to the acting user and core.has_workspace_role can
-- verify they're really the current Owner.
create or replace function public.transfer_workspace_ownership(
  p_workspace_id uuid,
  p_new_owner_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_member_id uuid;
  v_target_workspace_id uuid;
begin
  if not core.has_workspace_role(p_workspace_id, array['owner']) then
    raise exception 'Solo el Owner puede transferir la propiedad del workspace.';
  end if;

  select id into v_caller_member_id
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  if v_caller_member_id is null then
    raise exception 'No se pudo identificar tu membresía en este workspace.';
  end if;

  if v_caller_member_id = p_new_owner_member_id then
    raise exception 'No podés transferirte la propiedad a vos mismo.';
  end if;

  select workspace_id into v_target_workspace_id
  from public.workspace_members
  where id = p_new_owner_member_id;

  if v_target_workspace_id is distinct from p_workspace_id then
    raise exception 'Miembro no encontrado en este workspace.';
  end if;

  update public.workspace_members set role = 'owner' where id = p_new_owner_member_id;
  update public.workspace_members set role = 'admin' where id = v_caller_member_id;
end;
$$;

revoke all on function public.transfer_workspace_ownership(uuid, uuid) from public;
revoke all on function public.transfer_workspace_ownership(uuid, uuid) from anon;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated;
