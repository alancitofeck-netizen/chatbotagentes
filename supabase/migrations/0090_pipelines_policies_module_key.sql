-- Corrige un bug preexistente del módulo Pólizas (0088/0089): el módulo ya
-- se habilitó correctamente en workspace_modules_module_key_check (0089),
-- pero pipelines_module_key_check (0010_advisors_module.sql) nunca se
-- amplió para permitir 'policies' — ensurePolicyPipeline() (queries.ts)
-- intenta crear una fila en `pipelines` con module_key='policies' la
-- primera vez que se usa el módulo (crear una póliza, ver el tablero), y
-- esa fila SIEMPRE viola el constraint. En la práctica esto significa que
-- crear una póliza real nunca funcionó desde que se creó el módulo —
-- descubierto al verificar en vivo la Fase 1 de este mismo módulo.

alter table public.pipelines drop constraint if exists pipelines_module_key_check;
alter table public.pipelines add constraint pipelines_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'policies'));
