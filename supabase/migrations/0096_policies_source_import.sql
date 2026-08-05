-- El importador de Excel/CSV (import.ts) inserta source='import' — el
-- CHECK original (0088) solo permitía 'manual'/'pdf_ai', encontrado antes de
-- llegar a producción esta vez (mismo tipo de bug que 0090/0091/0093).
alter table public.policies drop constraint if exists policies_source_check;
alter table public.policies add constraint policies_source_check
  check (source in ('manual', 'pdf_ai', 'import'));
