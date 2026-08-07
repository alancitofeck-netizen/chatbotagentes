-- Registra la quinta plantilla de Mini Apps ("Diagnóstico Financiero -
-- Retiro") en el CHECK de template_key — mismo patrón drop/re-add que
-- 0064_calculadora_brecha_retiro_template.sql, 0073_mini_apps_app_vinculada_template.sql
-- y 0114_mini_apps_diagnostico_financiero_template.sql.

alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in ('simulador_retiro', 'calculadora_brecha_retiro', 'app_vinculada', 'diagnostico_financiero', 'diagnostico_financiero_retiro'));
