-- Extrae las respuestas del Meeting OS (hoy solo persistidas dentro del
-- jsonb opaco asesorias.state) a filas normalizadas consultables — ver
-- src/lib/asesorias/responseExtraction.ts para la lógica de extracción y
-- src/app/api/asesorias/[asesoriaId]/sync/route.ts para el upsert.
-- Mismo patrón de RLS que asesorias (0116_asesorias_module.sql).

create table public.asesoria_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  asesoria_id uuid not null references public.asesorias (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  advisor_id uuid references public.workspace_members (id) on delete set null,
  question_key text not null,
  question text not null,
  answer jsonb not null,
  answer_type text not null check (answer_type in (
    'text', 'money', 'choice', 'multi_choice', 'ranking', 'feedback',
    'decision_makers', 'next_step', 'referral', 'prospect_field'
  )),
  slide_number int,
  section text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asesoria_id, question_key)
);

create index asesoria_responses_asesoria_idx on public.asesoria_responses (asesoria_id);
create index asesoria_responses_contact_idx on public.asesoria_responses (contact_id, updated_at desc);

alter table public.asesoria_responses enable row level security;

create policy asesoria_responses_select on public.asesoria_responses
  for select using (core.is_workspace_member(workspace_id));

create policy asesoria_responses_insert on public.asesoria_responses
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy asesoria_responses_update on public.asesoria_responses
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));

create policy asesoria_responses_delete on public.asesoria_responses
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
