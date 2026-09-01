-- Permite repetir tutoriales omitidos/completados desde "Tu aprendizaje"
-- (LearningProgress.tsx) — un tour ahora puede quedar 'in_progress' igual
-- que ya podían los 6 pasos del checklist inicial (onboarding_progress),
-- en vez de solo pending/completed/skipped.
alter table public.learning_progress drop constraint learning_progress_status_check;
alter table public.learning_progress add constraint learning_progress_status_check
  check (status in ('pending', 'in_progress', 'completed', 'skipped'));
