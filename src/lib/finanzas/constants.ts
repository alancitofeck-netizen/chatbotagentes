/** Client-safe constants — mismo criterio que collections/constants.ts. */

export const FINANZAS_CATEGORIES = {
  poliza: { label: "Pólizas", tipo: "in" },
  asesoria: { label: "Asesorías", tipo: "in" },
  venta: { label: "Ventas", tipo: "in" },
  herramienta: { label: "Herramientas", tipo: "out" },
  curso: { label: "Cursos", tipo: "out" },
  gasto: { label: "Otros gastos", tipo: "out" },
} as const;

export type FinanzasCategoria = keyof typeof FINANZAS_CATEGORIES;
export type FinanzasTipo = "in" | "out";

export function categoriasFor(tipo: FinanzasTipo): FinanzasCategoria[] {
  return (Object.keys(FINANZAS_CATEGORIES) as FinanzasCategoria[]).filter((k) => FINANZAS_CATEGORIES[k].tipo === tipo);
}

export const FINANZAS_PAYMENT_METHODS = [
  "Transferencia",
  "Tarjeta de crédito",
  "Tarjeta de débito",
  "Efectivo",
  "Mercado Pago",
  "PayPal",
  "Débito automático",
  "Otro",
] as const;

export const FINANZAS_CURRENCIES = ["USD", "ARS", "MXN"] as const;
export const FINANZAS_RECURRENCIAS = ["ninguna", "mensual", "anual"] as const;
export type FinanzasRecurrencia = (typeof FINANZAS_RECURRENCIAS)[number];

export type FinanzasEstado = "pendiente" | "pagado";

/** Bucket "de vista" — nunca se persiste, se deriva de estado + fecha_vencimiento
 * en cada lectura (mismo criterio que deriveCollectionBucket). "pronto" = vence
 * en los próximos 3 días (pedido explícito del usuario). */
export type FinanzasBucket = "pagado" | "vencido" | "pronto" | "pendiente";

export function deriveFinanzasBucket(estado: FinanzasEstado, fechaVencimiento: string): FinanzasBucket {
  if (estado === "pagado") return "pagado";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(fechaVencimiento);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "vencido";
  if (diffDays <= 3) return "pronto";
  return "pendiente";
}

export const FINANZAS_BUCKET_LABEL: Record<FinanzasBucket, string> = {
  pagado: "Pagado",
  vencido: "Vencido",
  pronto: "Pronto",
  pendiente: "Pendiente",
};

export const FINANZAS_BUCKET_VARIANT: Record<FinanzasBucket, "success" | "error" | "warning" | "neutral"> = {
  pagado: "success",
  vencido: "error",
  pronto: "warning",
  pendiente: "neutral",
};
