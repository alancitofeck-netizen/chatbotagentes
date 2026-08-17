-- Acceso a "Asesores" (y todo lo agencia-céntrico: Operaciones/sincronización
-- por asesor) por USUARIO, no por workspace activo — un owner/admin real de
-- la agencia también puede tener su propio workspace personal de asesor, y
-- hasta ahora solo podía usar estos módulos si estaba parado EN el
-- workspace de la agencia (isAgencyWorkspace, 0144). Pedido explícito del
-- usuario: que puedan usarlos desde su propio workspace, sin cambiarse.
--
-- Seguro sin tocar RLS: core.is_workspace_member/has_workspace_role ya
-- chequean la fila real de workspace_members para el workspace_id que se
-- consulta, nunca el workspace activo de la sesión — el fix es solo de
-- resolución de qué workspace_id usar en las queries de la app.
create or replace function core.agency_workspace_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = (select user_id from public.platform_admins order by created_at asc limit 1)
  limit 1
$$;

create or replace function core.current_user_agency_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select wm.role
  from public.workspace_members wm
  where wm.user_id = auth.uid()
    and wm.workspace_id = core.agency_workspace_id()
  limit 1
$$;
