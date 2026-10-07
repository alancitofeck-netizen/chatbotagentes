// Agrega metas y un bono QA al branch qa-mobile, sin borrar nada.
//   node scripts/qa/branch.mjs node scripts/qa/seed-metas.mjs
// Sólo corre contra el branch (BRANCH_REF) y es idempotente (se detiene si ya hay metas "[QA]").
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
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data; };

const have = must(await db.from("sales_goals").select("id").eq("workspace_id", WS).like("name", "[QA]%").limit(1), "check");
if (have.length) { console.log("Ya hay metas QA; nada que hacer."); process.exit(0); }

const members = must(await db.from("workspace_members").select("id, role").eq("workspace_id", WS), "members");
const admin = members.find((m) => m.role === "admin");
const agent = members.find((m) => m.role === "agent");
const now = new Date();
const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
const row = (name, metric_key, goal_kind, target_value, member_id, reward_label = null) => ({
  workspace_id: WS, member_id, created_by: admin.id, name, metric_key, goal_kind, reward_label, target_value, period_start: start, period_end: end, status: "active",
});
must(await db.from("sales_goals").insert([
  row("[QA] Pólizas emitidas en el mes", "policies_count", "meta", 6, agent.id),
  row("[QA] Prima emitida del mes", "premium_issued", "meta", 5000, agent.id),
  row("[QA] Clientes nuevos", "new_clients", "meta", 3, agent.id),
  row("[QA] Bono trimestral de Retiro", "policies_count", "bono", 10, null, "US$ 500"),
]), "goals");
console.log("Metas QA creadas: 4");
