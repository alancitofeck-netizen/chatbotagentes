-- Ediciones de los leads del tablero de ManyChat hechas desde el CRM.
--
-- Los leads del tablero no viven en la base: se leen en vivo de la hoja de
-- Google Sheets del workspace (src/lib/manychat/sheetSource.ts), con permiso
-- de solo lectura. Para poder editarlos (datos de contacto, estado, valor,
-- nota) sin escribir en la hoja, cada edición se guarda acá y se aplica encima
-- de lo que trae la hoja (src/lib/manychat/leads.ts: applyLeadOverrides). Lo
-- editado en el CRM manda sobre la hoja; un campo en null no pisa nada.
--
-- No se reutiliza manychat_conversations (0176): esa tabla es la de las
-- conversaciones del webhook de ManyChat, atada a un contacto del CRM, y los
-- leads de la hoja no tienen contacto propio. `lead_ref` es la clave estable del
-- lead en la hoja: la columna id de ManyChat, si la trae; si no, el teléfono; si
-- no, el número de fila.

create table public.manychat_lead_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_ref text not null,
  nombre text,
  telefono text,
  email text,
  usuario text,
  nota text,
  etapa text check (etapa in (
    'nuevo', 'contactado', 'calificado', 'agenda', 'confirmacion', 'cita', 'calendario', 'propuesta', 'cliente'
  )),
  valor numeric,
  updated_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, lead_ref)
);

alter table public.manychat_lead_overrides enable row level security;

-- Cualquier miembro del workspace las ve y las edita (el asesor administra su
-- propio tablero; el modo supervisor no tiene fila de miembro y queda afuera).
create policy manychat_lead_overrides_select on public.manychat_lead_overrides
  for select using (core.is_workspace_member(workspace_id));
create policy manychat_lead_overrides_insert on public.manychat_lead_overrides
  for insert with check (core.is_workspace_member(workspace_id));
create policy manychat_lead_overrides_update on public.manychat_lead_overrides
  for update using (core.is_workspace_member(workspace_id)) with check (core.is_workspace_member(workspace_id));
