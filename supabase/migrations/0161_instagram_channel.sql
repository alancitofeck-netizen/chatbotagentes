-- Instagram como canal nativo del Inbox — agrega el concepto genérico de
-- "channel" que hoy no existe (whatsapp_phone_number_id/whatsapp_web_chat_id
-- son los únicos marcadores de canal, ambos específicos de WhatsApp, y
-- quedan sin tocar). Todo aditivo, default 'whatsapp' preserva el
-- comportamiento actual exacto para cada fila ya existente.

alter table public.integration_connections drop constraint if exists integration_connections_provider_check;
alter table public.integration_connections add constraint integration_connections_provider_check
  check (provider in ('ycloud', 'openrouter', 'highlevel', 'google_calendar', 'calendly', 'google_drive', 'google_sheets', 'google_account', 'instagram'));

alter table public.conversations add column if not exists channel text not null default 'whatsapp';
-- Correlación genérica por canal (para Instagram: el IGSID del contacto) —
-- reusable para un futuro Messenger sin otra migración. WhatsApp sigue
-- usando whatsapp_phone_number_id/whatsapp_web_chat_id tal cual.
alter table public.conversations add column if not exists channel_thread_id text;
alter table public.conversations drop constraint if exists conversations_channel_check;
alter table public.conversations add constraint conversations_channel_check check (channel in ('whatsapp', 'instagram'));
create unique index if not exists conversations_channel_thread_unique
  on public.conversations (workspace_id, channel, channel_thread_id) where channel_thread_id is not null;

alter table public.messages add column if not exists channel text not null default 'whatsapp';

alter table public.contacts add column if not exists instagram_user_id text;
alter table public.contacts add column if not exists instagram_username text;
alter table public.contacts drop constraint if exists contacts_instagram_user_id_unique;
alter table public.contacts add constraint contacts_instagram_user_id_unique unique (workspace_id, instagram_user_id);
