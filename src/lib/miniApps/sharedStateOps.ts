/** Cambios que manda una mini app alojada con estado compartido (calendarios de contenido):
 * cada op fija un valor dentro del documento JSON. Se aplican sobre la última versión guardada,
 * así dos personas que editan campos distintos a la vez no se pisan.
 *
 * Formas de `p` (path):
 *  - [clave]                    → reemplaza esa clave de primer nivel entera (ej. una lista tras
 *                                 agregar/borrar elementos).
 *  - [objeto, campo]            → si state[objeto] es un objeto (no lista): fija ese campo.
 *  - [lista, idDelItem, campo]  → busca en state[lista] el item con `id` (o `n`) igual y fija ese campo. */
export interface SharedStateOp {
  p: (string | number)[];
  v: unknown;
}

export const MAX_SHARED_STATE_BYTES = 1_000_000;
export const MAX_SHARED_STATE_OPS = 500;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function parseSharedStateOps(raw: unknown): SharedStateOp[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_SHARED_STATE_OPS) return null;
  const ops: SharedStateOp[] = [];
  for (const item of raw) {
    if (!isPlainObject(item) || !Array.isArray(item.p) || item.p.length < 1 || item.p.length > 3 || !("v" in item)) return null;
    if (!item.p.every((seg) => (typeof seg === "string" && seg.length <= 200 && !FORBIDDEN_KEYS.has(seg)) || typeof seg === "number")) return null;
    ops.push({ p: item.p as (string | number)[], v: item.v });
  }
  return ops;
}

/** Devuelve un documento nuevo (no muta el recibido). Ops que no encajan con la forma del
 * documento (item borrado por otra persona, etc.) se ignoran. */
export function applySharedStateOps(state: Record<string, unknown>, ops: SharedStateOp[]): Record<string, unknown> {
  const next = structuredClone(state);
  for (const { p, v } of ops) {
    const [key, second, third] = p;
    if (typeof key !== "string") continue;
    if (p.length === 1) {
      next[key] = structuredClone(v);
      continue;
    }
    const target = next[key];
    if (p.length === 2 && isPlainObject(target) && typeof second === "string") {
      target[second] = structuredClone(v);
      continue;
    }
    if (p.length === 3 && Array.isArray(target) && typeof third === "string") {
      const item = target.find((x) => isPlainObject(x) && (x.id === second || x.n === second));
      if (isPlainObject(item)) item[third] = structuredClone(v);
    }
  }
  return next;
}
