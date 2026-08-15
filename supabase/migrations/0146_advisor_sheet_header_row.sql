-- Algunas hojas tienen una fila de título arriba de los encabezados reales
-- (ej. "AGENDAS" sola en la fila 1, con FECHA/HORA/... en la fila 2) — sin
-- esto el runner asumía siempre rows[0] como encabezado, rompiendo el
-- mapeo de columnas para esas hojas. 1-based (fila 1 = default, igual que
-- lo que ve el usuario en Sheets).
alter table public.advisor_sheet_connections add column header_row int not null default 1 check (header_row >= 1);
