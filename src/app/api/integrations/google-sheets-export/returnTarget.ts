/** A dónde vuelve el OAuth de la cuenta de Google con escritura: Asesorías > Referidos ("Exportar
 * referidos a hoja") o Agenda (panel "Conectar hoja de agendas"). Lista cerrada a propósito — el
 * destino nunca se toma tal cual de la URL (open redirect). */
export function googleSheetsExportReturnPath(target: "referidos" | "agenda"): string {
  return target === "agenda" ? "/agenda" : "/asesorias/referidos";
}
