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
