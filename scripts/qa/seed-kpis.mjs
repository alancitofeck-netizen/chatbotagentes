// Agrega setters y entradas de KPIs QA al branch qa-mobile (simula una hoja conectada).
//   node scripts/qa/branch.mjs node scripts/qa/seed-kpis.mjs
// Sólo corre contra el branch (BRANCH_REF) y es idempotente (se detiene si ya hay setters "[QA]").
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

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

const have = must(await db.from("kpi_setters").select("id").eq("workspace_id", WS).like("display_name", "[QA]%").limit(1), "check");
if (have.length) { console.log("Ya hay setters QA; nada que hacer."); process.exit(0); }

const now = new Date();
const periodMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
const names = ["[QA] Lucas Romero", "[QA] Mica Herrera", "[QA] Tomás Ibáñez"];
const setters = must(await db.from("kpi_setters").insert(names.map((display_name) => ({
  workspace_id: WS, display_name, normalized_name: display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), spreadsheet_id: "qa-sheet", sheet_name: "KPIs", status: "active",
}))).select("id, display_name"), "setters");

const base = [[120, 46, 21, 12], [95, 40, 19, 11], [80, 28, 11, 6]];
const rows = [];
setters.forEach((s, i) => {
  for (let w = 1; w <= 4; w++) {
    const f = 1 + (w - 2) * 0.08;
    const [con, acep, resp, conv] = base[i].map((n) => Math.round(n * f));
    rows.push({
      workspace_id: WS, setter_id: s.id, period_month: periodMonth, week_number: w,
      conexion: con, conexiones_aceptadas: acep, respuestas_primer_mensaje: resp, primer_mensaje_enviado: acep, en_conversacion: conv,
      no_le_interesa: Math.round(resp * 0.2), seguimiento_conversacion: Math.round(conv * 0.5), seguimiento_agenda: Math.round(conv * 0.3), agenda_manual: Math.round(conv * 0.2),
      calificadas: Math.round(conv * 0.6), source_row_hash: crypto.randomUUID(), is_stale: false,
    });
  }
});
must(await db.from("kpi_entries").insert(rows), "entries");
console.log("KPIs QA creados: setters", setters.length, "entradas", rows.length);
