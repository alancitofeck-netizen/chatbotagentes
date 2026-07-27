-- Importador de Cartera (Fase 1) — supports suggesting a merge between two
-- NEW insurer/branch/product names found in the SAME file (e.g. "Federacion
-- Patronal" vs "Federación Patronal S.A."), not just against the workspace's
-- already-existing catalog (suggestLookupMatches, 0056). Kept as a separate
-- nullable text column rather than repurposing match_candidate_id (a real
-- catalog row id) — resolveLookup (rowProcessor.ts) tells the two apart by
-- which column is populated, and this one is resolved at background-process
-- time by looking up the sibling import_job_lookups row's resolved_entity_id
-- once IT finishes (findSiblingResolvedId), so it never needs a real id up
-- front.
alter table public.import_job_lookups
  add column if not exists merge_target_normalized_value text;
