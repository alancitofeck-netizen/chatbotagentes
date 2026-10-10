/** Un reenvío del mismo lead (misma Mini App, mismo WhatsApp y misma `fecha`,
 * p. ej. una página de varios pasos que vuelve a enviar al sumar la urgencia)
 * no crea un lead nuevo: suma sus datos al existente. Devuelve la data
 * combinada, o null si no aporta nada nuevo (no hace falta escribir). Lo nuevo
 * pisa a lo anterior en la misma clave; un valor vacío nunca borra uno lleno. */
export function mergeRepeatedLeadData(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> | null {
  const merged = { ...existing };
  let changed = false;
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined || value === "") continue;
    if (JSON.stringify(merged[key]) === JSON.stringify(value)) continue;
    merged[key] = value;
    changed = true;
  }
  return changed ? merged : null;
}
