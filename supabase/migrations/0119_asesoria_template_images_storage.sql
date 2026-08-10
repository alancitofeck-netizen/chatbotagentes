-- Bucket para las imágenes que el asesor sube DENTRO del editor del Meeting
-- OS (recursos de "Referidos", logo de marca, imágenes de "Recap") — hoy
-- viajan como base64 embebidas en el propio JSON de la plantilla
-- (compressImage()/saveLogo() en el archivo verbatim, ver
-- meetingOsTemplate.ts), lo que hace que el payload de /sync y
-- /save-master-template supere el límite de tamaño de las funciones
-- serverless de Vercel apenas se suben un par de fotos — el guardado falla
-- en silencio (el propio Meeting OS ignora el error del fetch). El shim de
-- frame/route.ts ahora sube esas imágenes acá ANTES de mandar el payload,
-- reemplazando el data: URI por la URL pública — el archivo verbatim en sí
-- no se toca, solo lo que el shim manda por la red.
--
-- Mismo shape exacto que presentation-assets (0102_presentations_module.sql):
-- público + policy SELECT propia (el INSERT de Storage usa RETURNING, falla
-- RLS sin esto aunque el bucket sea público), path {workspace_id}/
-- {asesoria_id}/... como primer segmento. Las escrituras reales van todas
-- por service-role (Storage no valida la clave de firma ES256 de este
-- proyecto) — estas políticas quedan como higiene, igual que las de ahí.
insert into storage.buckets (id, name, public)
values ('asesoria-template-images', 'asesoria-template-images', true)
on conflict (id) do nothing;

create policy "asesoria_template_images_storage_select" on storage.objects
  for select using (bucket_id = 'asesoria-template-images');

create policy "asesoria_template_images_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'asesoria-template-images'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

create policy "asesoria_template_images_storage_update" on storage.objects
  for update using (
    bucket_id = 'asesoria-template-images'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

create policy "asesoria_template_images_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'asesoria-template-images'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );
