-- Módulo independiente "ManyChat" (fuera de CRM) — suma atribución de
-- contenido OPCIONAL (source/content_name/entry_point/campaign): ManyChat
-- no expone esto como system field (confirmado contra la documentación
-- oficial), así que estas columnas solo se completan si el propio usuario
-- las manda a mano como texto fijo en el paso "External Request" de cada
-- automatización — quedan null para cualquier evento que no las incluya,
-- nunca se inventan.
alter table public.manychat_conversations add column if not exists source text;
alter table public.manychat_conversations add column if not exists content_name text;
alter table public.manychat_conversations add column if not exists entry_point text;
alter table public.manychat_conversations add column if not exists campaign text;

create index if not exists manychat_conversations_source_idx on public.manychat_conversations (workspace_id, source) where source is not null;

-- "Sincronizar ahora" (refresca contactos YA conocidos vía getInfo — la API
-- pública de ManyChat no tiene endpoint de listado/exportación masiva,
-- confirmado, así que esto nunca descubre leads nuevos) necesita saber
-- cuándo corrió la última vez.
alter table public.integration_connections add column if not exists last_synced_at timestamptz;
