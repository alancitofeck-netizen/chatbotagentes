-- El evento nuevo policy_renewal_reminder (catalog.ts) usa category='polizas',
-- pero ni notifications ni notification_preferences (0076/0081) tenían esa
-- categoría en su CHECK — mismo tipo de bug que 0090/0091 (constraint no
-- ampliado al agregar un módulo nuevo), encontrado antes de que llegara a
-- producción esta vez.

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('crm', 'inbox', 'calendario', 'automatizaciones', 'agentes', 'ia', 'sistema', 'polizas'));

alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences add constraint notification_preferences_category_check
  check (category in ('crm', 'inbox', 'calendario', 'automatizaciones', 'agentes', 'ia', 'sistema', 'polizas'));
