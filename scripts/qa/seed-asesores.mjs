// Activa el módulo Asesores en qa-mobile y agrega 5 cuentas de asesores de prueba (con contrato las activas).
//   node scripts/qa/branch.mjs node scripts/qa/seed-asesores.mjs
// Sólo corre contra el branch (BRANCH_REF). Idempotente: se detiene si ya hay clientes "[QA]".
import { createClient } from "@supabase/supabase-js";

const BRANCH_REF = "evoanshcejupacdtruev";
const WS = "5b1c0e7a-0000-4000-8000-000000000001";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url.includes(BRANCH_REF) || !key) {
  console.error("Negado: esto sólo corre contra el branch qa-mobile (usá scripts/qa/branch.mjs).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (r, w) => {
  if (r.error) throw new Error(`${w}: ${r.error.message}`);
  return r.data;
};

must(await db.from("workspace_modules").upsert({ workspace_id: WS, module_key: "asesores", enabled: true }, { onConflict: "workspace_id,module_key" }), "módulo");

const have = must(await db.from("contacts").select("id").eq("workspace_id", WS).like("name", "[QA] Asesor%").limit(1), "check");
if (have.length) {
  console.log("Ya hay asesores QA; solo se aseguró el módulo.");
  process.exit(0);
}

const members = must(await db.from("workspace_members").select("id, role").eq("workspace_id", WS), "members");
const admin = members.find((m) => m.role === "admin");
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const rows = [
  ["[QA] Asesor Mariana Solís", "Agente de seguros", "activo", "green", 92, 149],
  ["[QA] Asesor Ricardo Peña", "Asesor patrimonial", "activo", "yellow", 61, 299],
  ["[QA] Asesor Daniela Ortiz", "Agente de seguros", "activo", "red", 34, 149],
  ["[QA] Asesor Leonardo Magaña", "Asesor financiero", "en_onboarding", null, null, null],
  ["[QA] Asesor Paula Benítez", "Agente de seguros", "pausado", null, null, null],
];
for (const [name, profession, status, health_score_label, health_score, monthly] of rows) {
  const contact = must(await db.from("contacts").insert({ workspace_id: WS, name, email: `${name.split(" ")[2].toLowerCase()}@example.com`, source: "manual" }).select("id").single(), "contact");
  const client = must(
    await db.from("clients").insert({ workspace_id: WS, contact_id: contact.id, profession, status, health_score, health_score_label, account_manager_id: admin?.id ?? null, country: "México", city: "CDMX" }).select("id").single(),
    "client",
  );
  if (monthly) {
    must(
      await db.from("client_contracts").insert({
        workspace_id: WS, client_id: client.id, status: "activo", start_date: day(-120), end_date: day(name.includes("Daniela") ? 20 : 240),
        duration_months: 12, monthly_value: monthly, total_value: monthly * 12, amount_paid: monthly * 4, currency: "USD",
      }),
      "contract",
    );
  }
}
console.log("Asesores QA creados:", rows.length);
