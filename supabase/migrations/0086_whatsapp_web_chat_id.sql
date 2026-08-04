-- Corrige el modelo de datos de WhatsApp Web: contacts.phone se venía usando
-- para dos cosas distintas — el número real E.164 Y, cuando WhatsApp
-- direcciona un chat por LID (Linked ID, su modo de privacidad de número
-- para contactos individuales y participantes de grupo) en vez de por
-- teléfono, el identificador interno crudo de WhatsApp terminaba guardado
-- ahí como si fuera un teléfono real. whatsapp_web_chat_id es la clave de
-- correlación real para una conversación de WhatsApp Web: siempre existe
-- (a diferencia del teléfono, que puede no conocerse nunca para un contacto
-- con privacidad de número activada) y es estable entre mensajes, así que
-- es lo que se usa para encontrar la conversación existente en vez de
-- depender de un teléfono que puede no existir.

alter table public.conversations add column if not exists whatsapp_web_chat_id text;

-- Parcial (where not null) porque YCloud nunca la usa y no debe exigirse
-- unicidad sobre NULLs — dos conversaciones de YCloud con esta columna en
-- NULL conviven sin problema.
create unique index if not exists conversations_workspace_wa_chat_id_key
  on public.conversations (workspace_id, whatsapp_web_chat_id)
  where whatsapp_web_chat_id is not null;
