// Agrega una conversación de ejemplo (4 mensajes) al Asistente IA del agente QA en qa-mobile,
// para ver el chat con mensajes sin llamar a la IA.
//   node scripts/qa/branch.mjs node scripts/qa/seed-asistente.mjs
// Sólo corre contra el branch (BRANCH_REF). Idempotente: no hace nada si la conversación ya tiene mensajes.
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

const agent = must(await db.from("workspace_members").select("id").eq("workspace_id", WS).eq("role", "agent").limit(1), "agent")[0];
const conv = must(await db.from("assistant_conversations").select("id").eq("workspace_id", WS).eq("member_id", agent.id).order("updated_at", { ascending: false }).limit(1), "conv")[0];
if (!conv) {
  console.log("El agente QA todavía no abrió el Asistente (no hay conversación). Abrí /asistente una vez y volvé a correr esto.");
  process.exit(0);
}
const existing = must(await db.from("assistant_messages").select("id").eq("conversation_id", conv.id).limit(1), "msgs");
if (existing.length) {
  console.log("La conversación ya tiene mensajes; nada que hacer.");
  process.exit(0);
}
const t = (min) => new Date(Date.now() - min * 60_000).toISOString();
must(
  await db.from("assistant_messages").insert([
    { conversation_id: conv.id, role: "user", content: "¿Cómo va mi día?", pending_tool_call_ids: [], created_at: t(6) },
    { conversation_id: conv.id, role: "assistant", content: "Hoy no tenés reuniones y tenés 1 tarea para hoy. Ojo: hay 22 cobros vencidos, el más grande es de [QA] Contacto 3 (450 MXN).", pending_tool_call_ids: [], created_at: t(5) },
    { conversation_id: conv.id, role: "user", content: "Creá una tarea para llamar a Pedro", pending_tool_call_ids: [], created_at: t(3) },
    { conversation_id: conv.id, role: "assistant", content: "Listo, te dejo la propuesta de la tarea. Confirmala y la creo.", pending_tool_call_ids: [], created_at: t(2) },
  ]),
  "insert",
);
console.log("Conversación de ejemplo creada en", conv.id);
