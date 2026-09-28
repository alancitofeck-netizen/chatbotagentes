-- Fase 2 del rediseño de Mini Apps: "Convertir en cliente y crear póliza"
-- reutiliza createPolicyAction (src/lib/policies/actions.ts) tal cual —
-- solo hace falta que policies.source acepte este origen y que el lead
-- recuerde a qué póliza quedó ligado, mismo criterio que ya existe para
-- contact_id/opportunity_id.
alter table public.policies drop constraint if exists policies_source_check;
alter table public.policies add constraint policies_source_check
  check (source in ('manual', 'pdf_ai', 'import', 'portal_sync', 'mini_app'));

alter table public.mini_app_leads add column if not exists policy_id uuid references public.policies (id) on delete set null;
