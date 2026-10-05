/**
 * Catálogo único de módulos del workspace. Fuente de verdad para:
 *  - la provisión de un workspace nuevo (src/lib/auth/provision-workspace.ts),
 *    que inserta una fila por módulo con su `defaultEnabled`;
 *  - la lista y los toggles de módulos en ajustes (src/lib/settings/queries.ts).
 *
 * Agregar un módulo nuevo es agregar una entrada acá. Antes había dos listas
 * que se desfasaban: la provisión no conocía `asesores` ni `presentations`, y los
 * workspaces creados después de sus backfills quedaban sin esos módulos.
 *
 * `defaultEnabled` reproduce la provisión anterior, salvo `asesores` y
 * `presentations`, que pasan a habilitarse (eran los que faltaban).
 */
export const MODULE_CATALOG = [
  { key: "crm", defaultEnabled: true },
  { key: "ats", defaultEnabled: false },
  { key: "advisors", defaultEnabled: true },
  { key: "mini_apps", defaultEnabled: true },
  { key: "asesorias", defaultEnabled: true },
  { key: "asesores", defaultEnabled: true },
  { key: "tasks", defaultEnabled: true },
  { key: "insurance_prospects", defaultEnabled: true },
  { key: "policies", defaultEnabled: true },
  { key: "collections", defaultEnabled: true },
  { key: "presentations", defaultEnabled: true },
  { key: "policy_extraction", defaultEnabled: true },
  { key: "goals", defaultEnabled: true },
  { key: "ai_assistant", defaultEnabled: true },
  { key: "insurance_providers", defaultEnabled: true },
  { key: "data_transfer", defaultEnabled: true },
  { key: "agenda", defaultEnabled: true },
  { key: "operaciones", defaultEnabled: false },
  { key: "manychat", defaultEnabled: false },
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number]["key"];

export const MODULE_KEYS: readonly ModuleKey[] = MODULE_CATALOG.map((m) => m.key);
