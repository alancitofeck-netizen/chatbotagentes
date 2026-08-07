-- Rediseño del módulo Automatizaciones a partir del feedback del usuario:
-- catálogo GLOBAL (mismo patrón que insurance_providers, 0107) en vez de
-- eager-seedear las 15 filas en cada workspace — automation_templates pasa
-- a ser una tabla de OVERRIDE pura (una fila solo existe una vez que el
-- workspace realmente togglea/edita algo distinto del default del
-- catálogo). Así "Biblioteca" siempre muestra las 15 cards, nunca una
-- pantalla vacía, sin duplicar el catálogo por workspace.
create table public.automation_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  icon text not null,
  category text not null,
  default_enabled boolean not null default true,
  default_message_template text not null default '',
  has_trigger boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index automation_catalog_category_idx on public.automation_catalog (category);

alter table public.automation_catalog enable row level security;

create policy automation_catalog_select on public.automation_catalog
  for select using (auth.uid() is not null);

-- Datos de prueba del diseño anterior (eager-seed, un solo workspace) — se
-- descartan sin problema, no hay clientes reales todavía. name/description
-- ahora los da el catálogo, no hace falta duplicarlos por override.
truncate table public.automation_templates;
alter table public.automation_templates drop column name;
alter table public.automation_templates drop column description;
alter table public.automation_templates alter column message_template drop not null;
alter table public.automation_templates alter column message_template drop default;
comment on column public.automation_templates.message_template is 'null = usa automation_catalog.default_message_template de esta automatización';

-- Historial real (pestaña "Historial"): quién se disparó, para quién, y si
-- falló — antes automation_send_log solo servía de dedupe interno.
alter table public.automation_send_log add column status text not null default 'completed' check (status in ('completed', 'failed'));
alter table public.automation_send_log add column error text;
alter table public.automation_send_log add column entity_label text;

insert into public.automation_catalog (key, name, description, icon, category, default_enabled, default_message_template, has_trigger, position) values
  ('birthday', 'Cumpleaños', 'Envía automáticamente un mensaje de cumpleaños por WhatsApp.', 'Cake', 'Clientes', true, '¡Feliz cumpleaños, {{nombre}}! 🎉 Todo el equipo te desea un día increíble. Gracias por confiar en nosotros.', false, 0),
  ('policy_anniversary', 'Aniversario de póliza', 'Felicita al cliente cuando cumple un año con su póliza.', 'CalendarHeart', 'Pólizas', true, 'Hola {{nombre}}, ¡hoy se cumple un año desde que confiaste en nosotros! Gracias por seguir eligiéndonos. 🎉', true, 1),
  ('collection_reminder', 'Recordatorio de cobranza', 'Envía un recordatorio antes del vencimiento del pago.', 'Wallet', 'Cobranza', true, 'Hola {{nombre}}, te recordamos que tu próximo pago vence pronto. Cualquier duda, escribinos.', true, 2),
  ('document_request', 'Solicitud de documentación', 'Solicita automáticamente la documentación faltante.', 'FileText', 'Pólizas', true, 'Hola {{nombre}}, nos falta un documento para continuar tu trámite. ¿Podrías enviárnoslo cuando puedas?', false, 3),
  ('policy_renewal', 'Renovación de póliza', 'Avisar al cliente cuando la póliza esté próxima a vencer.', 'CalendarClock', 'Pólizas', true, 'Hola {{nombre}}, tu póliza está por vencer. ¿Charlamos sobre la renovación?', true, 4),
  ('appointment_confirmation', 'Confirmación de cita', 'Cuando se agenda una reunión envía fecha, hora, link de Google Meet y mensaje de confirmación.', 'CalendarCheck2', 'Agenda', true, 'Hola {{nombre}}, confirmamos tu reunión para el {{fecha}}. Te esperamos — cualquier consulta, contactá a {{agente}}.', false, 5),
  ('appointment_reminder', 'Recordatorio de cita', 'Envía un recordatorio 24 horas antes de la reunión.', 'AlarmClock', 'Agenda', true, 'Hola {{nombre}}, te recordamos tu reunión de mañana. ¡Te esperamos!', false, 6),
  ('welcome', 'Bienvenida', 'Cuando un cliente nuevo entra al CRM envía un mensaje de bienvenida.', 'Hand', 'Clientes', false, '¡Hola {{nombre}}! Gracias por sumarte — soy {{agente}} y voy a acompañarte en todo lo que necesites.', true, 7),
  ('post_sale_followup', 'Seguimiento post venta', 'Envía un mensaje unos días después de contratar la póliza.', 'Sparkles', 'Ventas', true, 'Hola {{nombre}}, ¿cómo va todo con tu póliza? Cualquier consulta, estamos para ayudarte.', false, 8),
  ('review_request', 'Solicitud de reseña', 'Enviar un mensaje solicitando una reseña luego de finalizar el proceso.', 'Star', 'Marketing', true, 'Hola {{nombre}}, ¿nos ayudarías dejando una reseña sobre tu experiencia? Significa mucho para nosotros. 🌟', false, 9),
  ('prospect_recontact', 'Recontacto de prospectos', 'Reabre la conversación con un prospecto que quedó frío.', 'Send', 'Ventas', true, 'Hola {{nombre}}, quería retomar contacto — ¿seguís interesado en avanzar?', false, 10),
  ('unanswered_lead', 'Lead sin responder', 'Avisa cuando un lead no recibió respuesta en el tiempo esperado.', 'Flame', 'Ventas', true, 'Hola {{nombre}}, ¿pudiste ver mi mensaje anterior? Quedo atento.', false, 11),
  ('opportunity_followup', 'Seguimiento de oportunidad', 'Recuerda hacer seguimiento a una oportunidad abierta.', 'PhoneCall', 'Ventas', true, 'Hola {{nombre}}, quería hacer seguimiento de tu cotización — ¿tenés alguna duda?', false, 12),
  ('payment_received', 'Pago recibido', 'Confirma al cliente que su pago fue recibido.', 'CreditCard', 'Cobranza', true, '¡Gracias {{nombre}}! Confirmamos que recibimos tu pago correctamente.', true, 13),
  ('payment_overdue', 'Pago vencido', 'Avisa cuando un pago ya venció y sigue pendiente.', 'CircleAlert', 'Cobranza', true, 'Hola {{nombre}}, tu pago venció y sigue pendiente. ¿Podemos coordinarlo?', true, 14)
on conflict (key) do nothing;
