-- Tema visual del workspace (Configuración → Apariencia) — mismo patrón que
-- status/plan (0042_workspace_status_plan.sql): columna directo en
-- workspaces, sin tabla nueva ni RLS nueva (workspaces_select_own/
-- workspaces_update_owner_admin de 0001_workspaces_and_members.sql ya
-- cubren cualquier columna nueva de esta tabla).
--
-- Distinto del theme claro/oscuro existente (src/lib/theme/ThemeProvider.tsx,
-- localStorage por navegador, atributo data-theme en <html>) — este es la
-- "piel" de marca del workspace entero, persistida en DB, aplicada vía
-- data-workspace-theme en (protected)/layout.tsx. 'growthlink' es el default
-- y es el tema actual sin cambios.
alter table public.workspaces
  add column if not exists theme text not null default 'growthlink'
  check (theme in ('growthlink', 'ocean', 'lime-dark', 'violet'));
