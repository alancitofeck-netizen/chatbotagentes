-- Plantilla "maestra" de Meeting OS, POR ASESOR (no compartida para todo el
-- workspace) — separada de `asesorias` a propósito: no es el estado de una
-- asesoría puntual, es la base con la que se siembran las asesorías NUEVAS
-- que ese mismo asesor cree después (ver el plan de esta sesión). Una fila
-- por (workspace_id, advisor_id) — cada asesor guarda la suya sin pisar la
-- de sus compañeros, y no tiene que reeditar las preguntas cada vez que
-- arranca una asesoría nueva.
--
-- Se persiste desde el endpoint /api/asesorias/[asesoriaId]/save-master-
-- template, disparado por el shim de frame/route.ts cuando el propio
-- archivo verbatim escribe su key interna `gl-template-*` de localStorage
-- — solo pasa cuando el asesor aprieta "Guardar" en el editor, nunca en el
-- autoguardado de respuestas de una reunión en curso.
--
-- `template`/`theme`/`brand` se guardan juntos porque el propio Meeting OS
-- los manda juntos (`Store.saveTemplate(tpl, theme, brand)`, no se pueden
-- separar sin tocar el archivo) — pero solo `template` se usa hoy para
-- sembrar asesorías nuevas (ver seed.ts/meetingOsDefaults.ts); `theme`/
-- `brand` quedan guardados para un eventual uso futuro, sin comprometernos
-- a usarlos todavía.

create table public.asesoria_templates (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  advisor_id uuid not null references public.workspace_members (id) on delete cascade,
  template jsonb not null,
  theme jsonb not null,
  brand jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, advisor_id)
);

alter table public.asesoria_templates enable row level security;

-- select: el propio asesor ve su fila; owner/admin ven todas (para soporte).
create policy asesoria_templates_select on public.asesoria_templates
  for select using (
    core.has_workspace_role(workspace_id, array['owner', 'admin'])
    or exists (select 1 from public.workspace_members wm where wm.id = advisor_id and wm.user_id = auth.uid())
  );

-- insert/update/delete: solo la propia fila del asesor (advisor_id debe
-- corresponder a una membership real del usuario autenticado en ESE
-- workspace) — cualquier rol puede guardar su propia plantilla, mismo
-- criterio que ya permite editar cualquier asesoría (owner/admin/agent).
create policy asesoria_templates_insert on public.asesoria_templates
  for insert with check (
    exists (select 1 from public.workspace_members wm where wm.id = advisor_id and wm.user_id = auth.uid() and wm.workspace_id = workspace_id)
  );

create policy asesoria_templates_update on public.asesoria_templates
  for update using (
    exists (select 1 from public.workspace_members wm where wm.id = advisor_id and wm.user_id = auth.uid() and wm.workspace_id = workspace_id)
  );

create policy asesoria_templates_delete on public.asesoria_templates
  for delete using (
    exists (select 1 from public.workspace_members wm where wm.id = advisor_id and wm.user_id = auth.uid() and wm.workspace_id = workspace_id)
  );
