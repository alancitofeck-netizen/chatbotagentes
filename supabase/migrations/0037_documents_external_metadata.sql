-- Documentos <-> Google Drive: reuses the existing documents.external_id
-- (already provider-agnostic) as the Drive file id. These two additions are
-- the only schema change needed to support a full Drive browser tab inside
-- Documentos (per explicit ask: "no crear estructura paralela si ya existe
-- una tabla documentos") — external_url caches Drive's webViewLink (for
-- "Copiar enlace"/"Abrir en Drive" without an extra API round trip), and
-- external_metadata caches richer Drive fields (parents, owners, modifiedTime,
-- iconLink) refreshed on demand via the new "Actualizar desde Drive" action,
-- not a scheduled job (Vercel Hobby's 2-cron-job budget is already spent on
-- flush-buffers/sync-kpis).
alter table public.documents add column if not exists external_url text;
alter table public.documents add column if not exists external_metadata jsonb;
