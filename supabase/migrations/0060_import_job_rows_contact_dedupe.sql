-- Importador de Cartera — fixes a real, confirmed bug: detectContactDuplicates
-- (analysis.ts) only ever checked the CURRENT file's rows against contacts
-- ALREADY in the database — it never grouped the file's own rows against each
-- other. Real portfolios routinely have the same client on several rows (one
-- per policy), all sharing the same DNI — confirmed live that this produced
-- N brand-new contacts instead of 1 contact + N policies, even with
-- contactDuplicateStrategy:'update' selected. The catalog side (insurers/
-- branches/products) already solved the equivalent problem for itself via
-- import_job_lookups.merge_target_normalized_value + findSiblingResolvedId
-- (0058) — this mirrors that same "resolve the first occurrence, have later
-- occurrences wait on it" pattern, adapted for contacts' exact-key dedupe
-- (DNI/CUIT/Email/Teléfono, not fuzzy names) at the import_job_rows level.
alter table public.import_job_rows
  add column if not exists contact_dedupe_key text;

-- Only ever queried scoped to one job_id at a time (findSiblingContactId/
-- siblingContactStillPending in rowProcessor.ts) — partial index skips the
-- (large majority of) rows that don't participate in any intra-file dedupe.
create index if not exists import_job_rows_contact_dedupe_idx
  on public.import_job_rows (job_id, contact_dedupe_key)
  where contact_dedupe_key is not null;
