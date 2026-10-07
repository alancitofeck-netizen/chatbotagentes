// Agrega documentos QA (solo filas de metadatos, sin archivo real) al branch qa-mobile.
//   node scripts/qa/branch.mjs node scripts/qa/seed-documentos.mjs
// Sólo corre contra el branch (BRANCH_REF) y es idempotente (se detiene si ya hay documentos "[QA]").
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

const have = must(await db.from("documents").select("id").eq("workspace_id", WS).like("name", "[QA]%").limit(1), "check");
if (have.length) { console.log("Ya hay documentos QA; nada que hacer."); process.exit(0); }
const members = must(await db.from("workspace_members").select("id, role").eq("workspace_id", WS), "members");
const agent = members.find((m) => m.role === "agent");

const docs = [
  ["[QA] Póliza Williams Feck.pdf", "application/pdf", 2300, "poliza_pdf"],
  ["[QA] Póliza Ivan Anduro.pdf", "application/pdf", 642400, "poliza_pdf"],
  ["[QA] Endoso cambio de beneficiario.pdf", "application/pdf", 91000, "endoso"],
  ["[QA] Recibo septiembre Laura Giménez.pdf", "application/pdf", 88000, "recibo"],
  ["[QA] Condiciones generales Sura.pdf", "application/pdf", 1200000, "condiciones_generales"],
  ["[QA] Contrato de agencia.pdf", "application/pdf", 540000, "contrato"],
  ["[QA] DNI Eduardo Rodriguez.jpg", "image/jpeg", 1100000, null],
  ["[QA] Cartera Allianz octubre.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 46000, "otro"],
];
must(await db.from("documents").insert(docs.map(([name, mime_type, size_bytes, doc_category], i) => ({
  workspace_id: WS, name, mime_type, size_bytes, doc_category, owner_id: agent.id, last_modified_by: agent.id,
  storage_path: `${WS}/qa-seed-${i}/${name}`, source: "upload",
}))), "documents");
console.log("Documentos QA creados:", docs.length);
