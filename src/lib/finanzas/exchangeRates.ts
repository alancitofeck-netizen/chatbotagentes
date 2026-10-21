/** Tipos de cambio aproximados a USD — un solo lugar para ajustarlos
 * (pedido explícito del usuario: "constante o tabla, en un solo lugar").
 * Conversión siempre en vivo al leer, sin snapshot histórico por movimiento:
 * no hay convención previa de multi-moneda en el proyecto que extender, y
 * esto replica el `RATES` del prototipo de referencia. */
export const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  ARS: 1 / 1200,
  MXN: 1 / 18.5,
};

export function toUsd(amount: number, currency: string): number {
  return amount * (EXCHANGE_RATES_TO_USD[currency] ?? 1);
}

/** Convierte entre dos monedas cualquiera, pasando por USD como base común
 * (mismos tipos de cambio de arriba) — para la moneda de visualización
 * elegible en los KPIs de Gastos (USD/ARS/MXN), sin tener que recalcular
 * nada del lado del servidor: los agregados ya vienen en USD, esto solo
 * los reexpresa en la moneda elegida al mostrarlos. */
export function convertCurrency(amount: number, from: string, to: string): number {
  const usd = toUsd(amount, from);
  const toRate = EXCHANGE_RATES_TO_USD[to] ?? 1;
  return usd / toRate;
}
