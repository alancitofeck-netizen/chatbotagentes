-- "Fusionar contacto" (rediseño del Inbox) — reasigna todo lo que cuelga del
-- contacto origen al contacto destino y borra el origen, en una sola
-- transacción. Se implementa como función (no una secuencia de llamadas
-- desde Next.js) precisamente porque es una operación difícil de revertir:
-- si algo fallara a mitad de camino con llamadas sueltas, quedarían datos
-- reasignados parcialmente. SECURITY DEFINER porque toca varias tablas con
-- políticas RLS distintas en un solo paso, igual que el resto de las
-- funciones multi-tabla de este proyecto (ver provision_whatsapp_web_session).
create or replace function public.merge_contacts(p_source_contact_id uuid, p_target_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_workspace_id uuid;
  v_target_workspace_id uuid;
begin
  if p_source_contact_id = p_target_contact_id then
    raise exception 'cannot merge a contact into itself';
  end if;

  select workspace_id into v_workspace_id from public.contacts where id = p_source_contact_id;
  select workspace_id into v_target_workspace_id from public.contacts where id = p_target_contact_id;

  if v_workspace_id is null or v_target_workspace_id is null then
    raise exception 'contact not found';
  end if;
  if v_workspace_id <> v_target_workspace_id then
    raise exception 'contacts belong to different workspaces';
  end if;
  if not core.is_workspace_member(v_workspace_id) then
    raise exception 'not authorized to merge contacts in this workspace';
  end if;

  -- Reassign every child record that has its own value worth keeping —
  -- notes follow automatically (they key off conversations.id, not
  -- contact_id directly). mini_app_leads is intentionally reassigned too
  -- even though its FK is ON DELETE SET NULL — losing the contact link on
  -- a lead record is a worse default than keeping it pointed at the
  -- surviving contact.
  update public.conversations set contact_id = p_target_contact_id where contact_id = p_source_contact_id;
  update public.opportunities set contact_id = p_target_contact_id where contact_id = p_source_contact_id;
  update public.bookings set contact_id = p_target_contact_id where contact_id = p_source_contact_id;
  update public.candidates set contact_id = p_target_contact_id where contact_id = p_source_contact_id;
  update public.lead_sheet_rows set contact_id = p_target_contact_id where contact_id = p_source_contact_id;
  update public.insurance_prospects set contact_id = p_target_contact_id where contact_id = p_source_contact_id;
  update public.mini_app_leads set contact_id = p_target_contact_id where contact_id = p_source_contact_id;

  -- Tags: move any tag the source has that the target doesn't — the
  -- (contact_id, tag_id) unique constraint means a plain UPDATE would
  -- collide if both contacts already share a tag, so this is an
  -- insert-missing instead.
  insert into public.contact_tags (contact_id, tag_id)
  select p_target_contact_id, tag_id
  from public.contact_tags
  where contact_id = p_source_contact_id
  on conflict (contact_id, tag_id) do nothing;

  -- Everything still pointing at the source contact at this point (contact_tags
  -- rows we just copied, and anything with ON DELETE CASCADE not explicitly
  -- reassigned above) goes with it.
  delete from public.contacts where id = p_source_contact_id;
end;
$function$;

revoke all on function public.merge_contacts(uuid, uuid) from public;
revoke all on function public.merge_contacts(uuid, uuid) from anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
