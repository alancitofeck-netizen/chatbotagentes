const intFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function fmtInt(n: number): string {
  return intFormat.format(Math.round(n));
}

/** Porcentaje sin decimales cuando es entero, con una cifra si hace falta. */
export function fmtPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")}%`;
}
