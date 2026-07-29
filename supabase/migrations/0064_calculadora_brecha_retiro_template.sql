-- Registra la segunda plantilla de Mini Apps ("Calculadora de Brecha de
-- Retiro") en el CHECK de template_key — mismo patrón drop/re-add que
-- 0010_advisors_module.sql ya usó para workspace_modules.module_key.

alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in ('simulador_retiro', 'calculadora_brecha_retiro'));
