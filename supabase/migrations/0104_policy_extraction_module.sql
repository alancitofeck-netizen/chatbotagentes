-- Módulo "Extracción IA" (policy_extraction): entrada propia en el sidebar
-- para el flujo de "subir PDF de póliza → la IA completa los campos →
-- confirmar" que ya existía como una hoja modal dentro de Pólizas
-- (PolicyPdfUploadSheet.tsx) — pedido explícito del usuario de que sea "un
-- módulo aparte" en vez de quedar escondido ahí adentro. No tiene tabla
-- propia: reusa policies/documents tal cual, solo necesita registrar su
-- module_key (mismo patrón que 0099/0100/0102).

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations', 'policy_extraction'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'policy_extraction', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'policy_extraction'
)
on conflict (workspace_id, module_key) do update set enabled = true;
