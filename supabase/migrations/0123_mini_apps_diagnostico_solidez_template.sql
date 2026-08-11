alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in ('simulador_retiro', 'calculadora_brecha_retiro', 'app_vinculada', 'diagnostico_financiero', 'diagnostico_financiero_retiro', 'diagnostico_solidez_financiera'));
