import type { FinanzasMovimiento } from "./queries";

/** Texto sugerido para recordar un cobro pendiente — función pura (sin
 * "server-only", para poder llamarla desde el cliente), nunca envía nada
 * (mismo criterio que el prototipo: solo arma el texto). */
export function buildRecordatorioMessage(m: FinanzasMovimiento): string {
  const nombre = m.contraparte?.trim().split(/\s+/)[0] || "el cliente";
  const fecha = new Date(m.fechaVencimiento).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  return `Hola ${nombre}, te recuerdo que el pago de "${m.descripcion}" por ${m.monto.toLocaleString("es-AR")} ${m.moneda} vence el ${fecha}. ¿Te paso los datos para transferir?`;
}
