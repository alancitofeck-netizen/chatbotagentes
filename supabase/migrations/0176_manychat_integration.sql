-- Integración ManyChat → GrowthLink — receptor pasivo de leads de Instagram
-- gestionados por ManyChat (que sigue siendo el dueño del flujo/automatización).
-- Reutiliza contacts (ya tiene instagram_user_id/instagram_username/source/
-- custom_fields, ver 0161_instagram_channel.sql) para identidad — solo suma
-- el identificador propio de ManyChat. La actividad/score es un concepto
-- nuevo (no encaja en conversations/messages, pensadas para mensajería
-- bidireccional en tiempo real que GrowthLink mismo envía/recibe — acá los
-- datos llegan como eventos discretos que el propio flujo de ManyChat decide
-- mandar, nunca un stream garantizado de cada mensaje).

alter table public.contacts add column if not exists manychat_contact_id text;
alter table public.contacts drop constraint if exists contacts_manychat_contact_id_unique;
alter table public.contacts add constraint contacts_manychat_contact_id_unique unique (workspace_id, manychat_contact_id);

-- integration_connections ya guarda "este workspace conectó tal proveedor",
-- pero credentials_vault_ref está pensado para secretos que GrowthLink usa
-- para llamar HACIA AFUERA. Acá es al revés: un secreto que GrowthLink emite
-- y necesita encontrar POR VALOR cuando ManyChat lo manda de vuelta en el
-- header Authorization — una columna indexada nueva, no Vault.
alter table public.integration_connections add column if not exists webhook_secret text;
create unique index if not exists integration_connections_webhook_secret_idx
  on public.integration_connections (webhook_secret) where webhook_secret is not null;
alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly', 'google_drive', 'google_sheets', 'google_account', 'instagram', 'manychat'));

create table public.manychat_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  manychat_contact_id text not null,
  first_interaction_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  lead_message_count int not null default 0,
  manychat_message_count int not null default 0,
  last_message_preview text,
  -- Triaje comercial manual del usuario dentro de GrowthLink — ManyChat
  -- nunca manda esto, es deliberadamente independiente de interaction_level
  -- (pedido explícito: "no confundir 'habló mucho' con 'lead calificado'").
  lead_status text not null default 'nuevo',
  interaction_level text not null default 'none' check (interaction_level in ('none', 'low', 'medium', 'high')),
  interaction_score int not null default 0 check (interaction_score between 0 and 100),
  -- Datos capturados por ManyChat (ej. {"interes": "Seguro de retiro"}) —
  -- solo lo que el payload real trajo, nunca inventado.
  captured_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, contact_id)
);
create index manychat_conversations_workspace_idx on public.manychat_conversations (workspace_id, interaction_score desc);

create table public.manychat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- inbound = lo mandó el lead, outbound = lo mandó ManyChat/el bot.
  direction text not null check (direction in ('inbound', 'outbound')),
  body text,
  event_type text not null default 'message',
  raw_payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index manychat_messages_contact_idx on public.manychat_messages (contact_id, created_at);

alter table public.manychat_conversations enable row level security;
alter table public.manychat_messages enable row level security;

-- Solo lectura para miembros del workspace — todo write real pasa por el
-- webhook (service-role), mismo criterio que tool_calls/webhook_events.
create policy manychat_conversations_select on public.manychat_conversations
  for select using (core.is_workspace_member(workspace_id));
create policy manychat_messages_select on public.manychat_messages
  for select using (core.is_workspace_member(workspace_id));

-- Módulo nuevo — sembrado DESHABILITADO a propósito (a diferencia del resto
-- de módulos ya existentes): requiere que el usuario genere un secreto y
-- configure ManyChat, no algo para prender solo en workspaces existentes.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in (
    'crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies',
    'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals',
    'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias', 'asesores', 'agenda',
    'operaciones', 'referrals', 'manychat'
  ));
