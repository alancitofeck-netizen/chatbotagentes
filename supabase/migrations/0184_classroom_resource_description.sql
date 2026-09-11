-- Classroom: los recursos de una lección (classroom_lesson_resources,
-- 0071_classroom_module.sql) solo tenían "label" (el nombre del archivo).
-- Se agrega una descripción opcional por recurso — pedida explícitamente
-- para que un PDF/imagen/enlace se presente como contenido de aprendizaje
-- ("Aprendé cómo configurar tu Portfolio Comercial"), no solo como un
-- nombre de archivo. Aditiva, nullable, sin backfill — ningún recurso
-- existente se ve afectado.

alter table public.classroom_lesson_resources
  add column description text;
