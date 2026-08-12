-- El módulo "Clientes"/"Asesores" resolvía la identidad (nombre/foto/email)
-- desde un `contacts` fabricado a mano en el workspace del Owner — nunca
-- estuvo conectado a las cuentas reales de asesores que ya existen como
-- workspaces reales (workspaces/workspace_members/auth.users). Esta
-- migración es puramente aditiva: no se toca workspace_id (sigue siendo el
-- workspace del Owner, mismo RLS/requireManagerRole de siempre) ni se borra
-- nada — solo se agrega el ancla al workspace real del asesor.
alter table public.clients add column if not exists linked_workspace_id uuid references public.workspaces(id);

create unique index if not exists clients_linked_workspace_id_key
  on public.clients(linked_workspace_id)
  where linked_workspace_id is not null;

-- Las fichas nuevas ya no fabrican un contacto para poder existir — la
-- identidad sale del workspace real (linked_workspace_id). contact_id sigue
-- existiendo para las filas legacy, ahora opcional.
alter table public.clients alter column contact_id drop not null;

-- Renombra el module_key existente (ya prendido por defecto en cada
-- self-service signup, ver provision-workspace.ts) para que coincida con el
-- nombre visible nuevo del módulo — evita que el toggle de Configuración
-- quede huérfano después del rename de UI/rutas. El CHECK de la tabla
-- restringe module_key a una lista fija — hay que soltarlo antes del UPDATE
-- (todavía hay filas 'clientes', que no está en la lista nueva) y
-- reagregarlo después, ya con todas las filas migradas a 'asesores'.
alter table public.workspace_modules drop constraint workspace_modules_module_key_check;

update public.workspace_modules set module_key = 'asesores' where module_key = 'clientes';

alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key = any (array['crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals', 'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias', 'asesores']));
