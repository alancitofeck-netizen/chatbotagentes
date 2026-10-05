// Ejecuta un comando con las variables del branch qa-mobile, sin escribirlas a disco.
//
//   node scripts/qa/branch.mjs <comando> [args...]
//
// Inyecta NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY y QA_TARGET=branch. Las claves se piden a la
// Management API con la CLI (SUPABASE_ACCESS_TOKEN del entorno). Lo que se
// imprime de las claves es sólo el nombre y la longitud, nunca el valor.
//
// Next.js no pisa variables que ya están en el proceso, así que un build o un
// `next start` lanzado con este wrapper ignora .env.local (producción).
import { execFileSync, spawn } from "node:child_process";

export const BRANCH_REF = "evoanshcejupacdtruev";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Uso: node scripts/qa/branch.mjs <comando> [args...]");
  process.exit(1);
}

const raw = execFileSync(
  "npx",
  ["-y", "supabase@2.119.0", "projects", "api-keys", "--project-ref", BRANCH_REF, "-o", "json"],
  { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] },
);
const keys = JSON.parse(raw.slice(raw.indexOf("[")));
const pick = (name) => {
  const k = keys.find((x) => x.name === name);
  if (!k?.api_key) throw new Error(`No se obtuvo la clave ${name} del branch`);
  return k.api_key;
};

const env = {
  ...process.env,
  QA_TARGET: "branch",
  NEXT_PUBLIC_SUPABASE_URL: `https://${BRANCH_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("anon"),
  SUPABASE_SERVICE_ROLE_KEY: pick("service_role"),
};

const child = spawn(args[0], args.slice(1), { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
