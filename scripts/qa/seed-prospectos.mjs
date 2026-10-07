// Agrega prospectos QA (módulo advisors) al branch qa-mobile, sin borrar nada.
//   node scripts/qa/branch.mjs node scripts/qa/seed-prospectos.mjs
// Sólo corre contra el branch (BRANCH_REF) y es idempotente: si el workspace QA ya
// tiene un pipeline "advisors", no hace nada.
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
const day = (n) => new Date(Date.now() + n * 86_400_000);

const exist = must(await db.from("pipelines").select("id").eq("workspace_id", WS).eq("module_key", "advisors").limit(1), "check");
if (exist.length) { console.log("Ya hay prospectos QA; nada que hacer."); process.exit(0); }

const pipe = must(await db.from("pipelines").insert({ workspace_id: WS, module_key: "advisors", name: "Prospectos y clientes" }).select("id").single(), "pipeline");
const names = ["Nuevo", "Contactado", "Propuesta", "Cliente", "Perdido"];
const stages = must(await db.from("pipeline_stages").insert(names.map((name, i) => ({ pipeline_id: pipe.id, name, position: i, is_won: name === "Cliente", is_lost: name === "Perdido" }))).select("id, name"), "stages");
const stage = (n) => stages.find((s) => s.name === n).id;

const rows = [
  ["Andrés Molina", "Nuevo", "Seguro de vida", 900, 90, "+5491155550711", 20],
  ["Belén Ocampo", "Nuevo", "Plan de retiro", 1800, 180, "+5491155550712", 45],
  ["Helena Sosa", "Nuevo", "Gastos médicos", 1300, 130, "+5491155550718", null],
  ["Cristian Vera", "Contactado", "Gastos médicos", 1200, 120, "+5493515550713", 15],
  ["Gonzalo Iturbe", "Contactado", "Seguro de auto", 600, 60, null, null],
  ["Delfina Rossi", "Propuesta", "Ahorro para estudios", 1500, 150, null, 60],
  ["Emiliano Paz", "Propuesta", "Seguro de vida", 1100, 110, "+5491155550715", 25],
  ["Fernanda Quiroga", "Cliente", "Plan de retiro", 2400, 240, "+5492615550716", 300],
];
let pos = {};
for (const [name, st, policyType, value, commission, phone, renew] of rows) {
  const contact = must(await db.from("contacts").insert({ workspace_id: WS, name, phone, email: `${name.split(" ")[0].toLowerCase()}@example.com`, company: null, source: "referido" }).select("id").single(), "contact");
  const opp = must(await db.from("opportunities").insert({ workspace_id: WS, contact_id: contact.id, title: `${policyType} — ${name}`, value, currency: "USD", status: "open" }).select("id").single(), "opp");
  pos[st] = (pos[st] ?? -1) + 1;
  const item = must(await db.from("pipeline_items").insert({ pipeline_id: pipe.id, stage_id: stage(st), item_type: "opportunity", item_id: opp.id, position: pos[st] }).select("id").single(), "item");
  must(await db.from("opportunities").update({ pipeline_item_id: item.id }).eq("id", opp.id), "link");
  must(await db.from("advisor_policies").insert({ workspace_id: WS, opportunity_id: opp.id, policy_type: policyType, commission, renewal_date: renew ? day(renew).toISOString().slice(0, 10) : null }), "policy");
}
console.log("Prospectos QA creados:", rows.length);
