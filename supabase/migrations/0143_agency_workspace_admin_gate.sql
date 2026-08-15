-- "Asesores" (src/lib/clients/actions.ts) gateaba TODAS sus acciones
-- (incluida crear la ficha de un asesor nuevo) a requirePlatformAdmin() —
-- el único "Owner global" hardcodeado en platform_admins (0039) — dejando
-- afuera a cualquier otro owner/admin real de ESE MISMO workspace de
-- agencia. El motivo original (evitar que el owner/admin de un workspace
-- AJENO, ej. el workspace propio de un asesor individual, pudiera leer/
-- escribir el roster de otra agencia) sigue siendo válido — no se
-- reemplaza por un simple requireManagerRole. Esta función identifica si
-- `ws_id` es "el workspace de una agencia real" (uno donde algún platform
-- admin es miembro real) sin exponer platform_admins entero (su RLS solo
-- deja ver la fila propia) — security definer, mismo patrón que
-- am_i_platform_admin.
create or replace function core.workspace_has_platform_admin_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.platform_admins pa on pa.user_id = wm.user_id
    where wm.workspace_id = ws_id
  )
$$;

create or replace function public.workspace_has_platform_admin_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select core.workspace_has_platform_admin_member(ws_id)
$$;

revoke all on function public.workspace_has_platform_admin_member(uuid) from public;
grant execute on function public.workspace_has_platform_admin_member(uuid) to authenticated;
