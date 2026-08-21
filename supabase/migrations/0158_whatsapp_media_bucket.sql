-- Bucket privado para media real de WhatsApp (imagen/audio/documento,
-- entrante y saliente) — mismo patrón exacto que el bucket `documents`
-- (0019_documents_module.sql): paths prefijados por workspace_id, RLS por
-- rol. La aplicación real de permisos pasa por una ruta proxy con
-- service-role (src/app/api/documents/upload/route.ts documenta por qué:
-- el Storage de este proyecto no valida bien RLS por auth.uid() directo),
-- estas policies son defensa en profundidad, mismo criterio que allá.
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

create policy "whatsapp_media_storage_select" on storage.objects
  for select using (
    bucket_id = 'whatsapp-media' and core.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "whatsapp_media_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'whatsapp-media' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'agent'])
  );

create policy "whatsapp_media_storage_update" on storage.objects
  for update using (
    bucket_id = 'whatsapp-media' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'agent'])
  );

create policy "whatsapp_media_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'whatsapp-media' and core.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
  );
