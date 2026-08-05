-- Categorización opcional de archivos — pedida para Pólizas (PDF de póliza /
-- Endoso / Recibo / Condiciones generales), pero agregada a `documents`
-- (no a una tabla específica de pólizas) porque es un concepto genuinamente
-- genérico que cualquier módulo con archivos relacionados podría usar más
-- adelante, mismo espíritu que related_type/related_id (sin CHECK — texto
-- libre, la lista de valores reconocidos es una convención de app-code por
-- related_type, no una restricción de base).
alter table public.documents add column if not exists doc_category text;
