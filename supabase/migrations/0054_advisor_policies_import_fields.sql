-- Importador de Cartera (Fase 1) — extends advisor_policies with the policy
-- fields the bulk importer needs to write (Prima/Premio/Suma asegurada,
-- fechas, comercial, and the FKs into the new 0053 catalogs). All nullable
-- and additive: DealFormSheet/createDeal/updateDeal (src/lib/advisors/
-- actions.ts) keep working completely untouched, still only ever writing
-- policy_type/renewal_date/commission — these new columns are populated by
-- the importer's row processor exclusively, for now.
alter table public.advisor_policies
  add column if not exists insurer_id uuid references public.insurers (id) on delete set null,
  add column if not exists branch_id uuid references public.insurance_branches (id) on delete set null,
  add column if not exists product_id uuid references public.insurance_products (id) on delete set null,
  -- Paso 5's policy-duplicate-detection key ("Número de póliza"). Not
  -- unique — real-world portfolios have messy/reused numbers across
  -- insurers, and this project's own opportunities/pipeline_items already
  -- tolerate messy source data rather than rejecting it outright.
  add column if not exists policy_number text,
  add column if not exists policy_status text,
  -- Argentine terminology: Prima (net premium) vs Premio (total, taxes
  -- included) are genuinely two different amounts the source file may
  -- both carry — kept as two separate columns rather than picking one.
  add column if not exists premium_net numeric,
  add column if not exists premium_total numeric,
  add column if not exists sum_insured numeric,
  add column if not exists payment_method text,
  add column if not exists payment_frequency text,
  add column if not exists issue_date date,
  add column if not exists start_date date,
  add column if not exists effective_date date,
  -- Distinct from the pre-existing renewal_date ("Próxima renovación") —
  -- this is "Fecha de vencimiento" from the source file, a different date
  -- in real policies (a policy can expire on one date and already have its
  -- next renewal scheduled on another).
  add column if not exists expiration_date date,
  add column if not exists productor text,
  add column if not exists ejecutivo text,
  add column if not exists oficina text;

create index if not exists advisor_policies_policy_number_idx on public.advisor_policies (workspace_id, policy_number);
