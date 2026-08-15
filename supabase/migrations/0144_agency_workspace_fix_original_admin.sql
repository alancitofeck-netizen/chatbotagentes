-- Corrige 0143: "tiene un platform admin como miembro" no distinguía el
-- workspace real de la agencia del workspace PROPIO de un asesor que
-- también resulta ser platform admin (ej. otorgado como workaround) — ese
-- asesor siempre sería "miembro platform admin" de SU PROPIO workspace,
-- pasando el check ahí también. Root cause real del bug reportado: un
-- platform admin operando "Asesores" desde su propio workspace (no el de
-- la agencia) terminaba auto-provisionando fichas de otros asesores ahí
-- (ensureAdvisorRecordsExist, clients/queries.ts) y podía chocar contra el
-- unique de clients.linked_workspace_id al crear una ficha ya existente en
-- otro lado — de ahí el "Server Components render error" genérico.
--
-- Fix: en vez de "cualquier platform admin", el ancla es específicamente
-- el platform admin MÁS ANTIGUO (alancitofeck@gmail.com, sembrado en
-- 0039) — es data-driven (no hardcodea el UUID acá), estable, y separa
-- correctamente "el workspace real de la agencia" (donde ese admin
-- original es miembro real) de cualquier otro workspace individual.
create or replace function core.workspace_has_platform_admin_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = (select user_id from public.platform_admins order by created_at asc limit 1)
  )
$$;
