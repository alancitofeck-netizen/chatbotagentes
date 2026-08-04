-- Segunda parte del bug de integración de Pólizas al motor de pipeline
-- genérico (ver 0090): pipeline_items.item_type (0002_crm_and_dashboard.sql)
-- solo permitía 'opportunity'/'candidate_application' — createPolicyAction
-- y duplicatePolicyAction (actions.ts) insertan item_type='policy' en cada
-- alta, así que esa fila también violaba el constraint desde que existe el
-- módulo. Encontrado al verificar en vivo la Fase 1.

alter table public.pipeline_items drop constraint if exists pipeline_items_item_type_check;
alter table public.pipeline_items add constraint pipeline_items_item_type_check
  check (item_type in ('opportunity', 'candidate_application', 'policy'));
