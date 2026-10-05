// Seed de datos QA para el branch qa-mobile (y sólo para ese branch).
//
// Uso (desde la raíz del repo):
//   node scripts/qa/branch.mjs node scripts/qa/seed-branch.mjs
//
// Seguridad:
//  - Sólo corre si la URL de Supabase es la del branch (BRANCH_REF). Nunca producción.
//  - Las claves salen de variables de entorno (las inyecta scripts/qa/branch.mjs);
//    no se escriben a disco.
//  - Las contraseñas de las cuentas QA se generan en memoria y se rotan en cada
//    corrida de los scripts de prueba (ver scripts/mobile-qa/qaUser.mjs).
//  - Idempotencia: si el workspace del branch ya existe, no vuelve a sembrar.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const BRANCH_REF = "evoanshcejupacdtruev";
export const BRANCH_WORKSPACE_ID = "5b1c0e7a-0000-4000-8000-000000000001";
export const QA_EMAIL = "qa-mobile@example.com";
export const QA_ADMIN_EMAIL = "qa-mobile-admin@example.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url.includes(BRANCH_REF)) {
  console.error(`Negado: NEXT_PUBLIC_SUPABASE_URL no es el branch ${BRANCH_REF}.`);
  process.exit(1);
}
if (!serviceKey) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY (usá scripts/qa/branch.mjs).");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};
const day = (n) => new Date(Date.now() + n * 86_400_000);
const dateOnly = (n) => day(n).toISOString().slice(0, 10);

async function ensureUser(email, name) {
  const list = must(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), "listUsers");
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;
  const password = crypto.randomBytes(18).toString("base64url") + "Aa1!"; // descartada: las pruebas rotan la contraseña
  const created = must(
    await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } }),
    `createUser ${email}`,
  );
  return created.user.id;
}

async function resetWorkspace() {
  const ws = BRANCH_WORKSPACE_ID;
  const pipes = must(await db.from("pipelines").select("id").eq("workspace_id", ws), "pipes");
  const pipeIds = pipes.map((p) => p.id);
  const contacts = must(await db.from("contacts").select("id").eq("workspace_id", ws), "contacts ids");
  const convs = must(await db.from("conversations").select("id").eq("workspace_id", ws), "convs");
  const pols = must(await db.from("policies").select("id").eq("workspace_id", ws), "pols");
  const polIds = pols.map((p) => p.id);
  if (polIds.length) must(await db.from("policy_payments").delete().in("policy_id", polIds), "del payments");
  if (convs.length) must(await db.from("messages").delete().in("conversation_id", convs.map((c) => c.id)), "del messages");
  must(await db.from("policies").delete().eq("workspace_id", ws), "del policies");
  must(await db.from("opportunities").delete().eq("workspace_id", ws), "del opps");
  must(await db.from("bookings").delete().eq("workspace_id", ws), "del bookings");
  must(await db.from("conversations").delete().eq("workspace_id", ws), "del convs");
  must(await db.from("tasks").delete().eq("workspace_id", ws), "del tasks");
  if (pipeIds.length) {
    must(await db.from("pipeline_items").delete().in("pipeline_id", pipeIds), "del items");
    must(await db.from("pipeline_stages").delete().in("pipeline_id", pipeIds), "del stages");
  }
  must(await db.from("pipelines").delete().eq("workspace_id", ws), "del pipelines");
  must(await db.from("contacts").delete().eq("workspace_id", ws), "del contacts");
  must(await db.from("workspace_modules").delete().eq("workspace_id", ws), "del modules");
  must(await db.from("workspace_members").delete().eq("workspace_id", ws), "del members");
  must(await db.from("workspaces").delete().eq("id", ws), "del workspace");
  void contacts;
  console.log("Workspace QA del branch limpiado; se vuelve a sembrar.");
}

async function main() {
  // Re-ejecutable: si el workspace del branch ya existe (corrida anterior, quizá
  // interrumpida), borra sólo sus filas y vuelve a sembrar. No toca otros workspaces.
  const existing = must(await db.from("workspaces").select("id").eq("id", BRANCH_WORKSPACE_ID).maybeSingle(), "check ws");
  if (existing) {
    await resetWorkspace();
  }

  const adminId = await ensureUser(QA_ADMIN_EMAIL, "QA Mobile Admin");
  const agentId = await ensureUser(QA_EMAIL, "QA Mobile");

  must(await db.from("workspaces").insert({ id: BRANCH_WORKSPACE_ID, name: "Workspace de qa-mobile", slug: "qa-mobile-branch", status: "active", plan: "pro" }), "workspace");
  must(
    await db.from("workspace_members").insert([
      { workspace_id: BRANCH_WORKSPACE_ID, user_id: adminId, role: "admin", title: "QA admin" },
      { workspace_id: BRANCH_WORKSPACE_ID, user_id: agentId, role: "agent", title: "QA agent" },
    ]),
    "members",
  );
  // Ancla de agencia: core.agency_workspace_id() toma el admin de plataforma más antiguo.
  must(await db.from("platform_admins").upsert({ user_id: adminId }), "platform_admins");

  const modules = ["advisors", "agenda", "ai_assistant", "asesorias", "collections", "crm", "data_transfer", "goals", "insurance_prospects", "insurance_providers", "mini_apps", "policies", "policy_extraction", "tasks"];
  must(await db.from("workspace_modules").insert(modules.map((m) => ({ workspace_id: BRANCH_WORKSPACE_ID, module_key: m, enabled: true }))), "modules");

  // Pipelines y etapas (mismos nombres que el workspace QA de producción).
  const crmStages = ["Nuevo", "Contactado", "Calificado", "Propuesta", "Negociación", "Ganado", "Perdido"];
  const polStages = ["Cotización", "Documentación", "Pendiente de emisión", "Emitida", "Activa", "Renovación próxima", "Renovación enviada", "Renovada", "Vencida", "Cancelada"];
  const crmPipe = must(await db.from("pipelines").insert({ workspace_id: BRANCH_WORKSPACE_ID, module_key: "crm", name: "Pipeline de ventas" }).select("id").single(), "crm pipe");
  const polPipe = must(await db.from("pipelines").insert({ workspace_id: BRANCH_WORKSPACE_ID, module_key: "policies", name: "Pólizas" }).select("id").single(), "pol pipe");
  const stageRows = (pipe, names, wonIdx, lostIdx) =>
    names.map((name, i) => ({ pipeline_id: pipe, name, position: i, is_won: i === wonIdx, is_lost: i === lostIdx }));
  const crmStageRows = must(await db.from("pipeline_stages").insert(stageRows(crmPipe.id, crmStages, 5, 6)).select("id, name"), "crm stages");
  const polStageRows = must(await db.from("pipeline_stages").insert(stageRows(polPipe.id, polStages, -1, -1)).select("id, name"), "pol stages");
  const crmStage = (name) => crmStageRows.find((s) => s.name === name).id;
  const polStage = (name) => polStageRows.find((s) => s.name === name).id;

  // Contactos y oportunidades (10 contactos, 8 oportunidades con su ítem de pipeline).
  const contacts = Array.from({ length: 10 }, (_, i) => ({
    workspace_id: BRANCH_WORKSPACE_ID,
    name: `[QA] Contacto ${i + 1}`,
    phone: `+5215500000${String(i + 1).padStart(3, "0")}`,
    email: `qa.contacto${i + 1}@example.com`,
    company: `QA Empresa ${i + 1}`,
    source: i % 2 ? "whatsapp" : "web",
  }));
  const contactRows = must(await db.from("contacts").insert(contacts).select("id, name"), "contacts");
  const contactId = (n) => contactRows.find((c) => c.name === `[QA] Contacto ${n}`).id;

  const stageNames = ["Nuevo", "Contactado", "Calificado", "Propuesta", "Calificado", "Propuesta", "Negociación", "Nuevo"];
  for (let i = 0; i < 8; i++) {
    const opp = must(
      await db.from("opportunities").insert({
        workspace_id: BRANCH_WORKSPACE_ID,
        contact_id: contactId(i + 1),
        title: `[QA] Oportunidad ${i + 1}`,
        value: 10000 * (i + 1),
        currency: "MXN",
        status: "open",
        priority: i % 3 === 0 ? "high" : "medium",
        probability: 50,
        expected_close_date: dateOnly(7 + i),
      }).select("id").single(),
      "opportunity",
    );
    const item = must(
      await db.from("pipeline_items").insert({ pipeline_id: crmPipe.id, stage_id: crmStage(stageNames[i]), item_type: "opportunity", item_id: opp.id, position: i }).select("id").single(),
      "pipeline item opp",
    );
    must(await db.from("opportunities").update({ pipeline_item_id: item.id }).eq("id", opp.id), "link opp item");
  }

  // Conversaciones (3) con mensajes entrantes: deben quedar "sin responder" para el dashboard.
  for (let i = 1; i <= 3; i++) {
    const conv = must(
      await db.from("conversations").insert({ workspace_id: BRANCH_WORKSPACE_ID, contact_id: contactId(i), status: "open", mode: "ai", channel: "whatsapp", last_message_at: day(-i * 0.2).toISOString() }).select("id").single(),
      "conversation",
    );
    must(
      await db.from("messages").insert([
        { workspace_id: BRANCH_WORKSPACE_ID, conversation_id: conv.id, direction: "outbound", sender_type: "ai", type: "text", content: { body: "[QA] Hola, ¿en qué te ayudo?" }, status: "sent", channel: "whatsapp", created_at: day(-i).toISOString() },
        { workspace_id: BRANCH_WORKSPACE_ID, conversation_id: conv.id, direction: "inbound", sender_type: "contact", type: "text", content: { body: "[QA] Con gusto, ¿qué cobertura buscás?" }, status: "delivered", channel: "whatsapp", created_at: day(-i * 0.1).toISOString() },
      ]),
      "messages",
    );
  }

  // Reservas (4) para agenda.
  for (let i = 0; i < 4; i++) {
    must(
      await db.from("bookings").insert({
        workspace_id: BRANCH_WORKSPACE_ID,
        contact_id: contactId(i + 1),
        start_time: day(i + 1).toISOString(),
        end_time: day(i + 1).toISOString(),
        status: "scheduled",
        subject: `[QA] Cita con Contacto ${i + 1}`,
        event_type: "meeting",
        timezone: "America/Argentina/Buenos_Aires",
        fuente: "otro",
      }),
      "booking",
    );
  }

  // Tareas (6).
  for (let i = 0; i < 6; i++) {
    must(
      await db.from("tasks").insert({
        workspace_id: BRANCH_WORKSPACE_ID,
        title: `[QA] Tarea ${i + 1}`,
        status: i === 5 ? "completed" : "pending",
        priority: i % 3 === 0 ? "high" : "medium",
        due_at: day(i - 2).toISOString(),
        assigned_to: null,
        created_by: null,
        owner_side: "growth_link",
      }),
      "task",
    );
  }

  // Pólizas (3) con ítem de pipeline y 2 cobros (uno vencido).
  const polNames = [["Activa", "auto"], ["Pendiente de emisión", "vida"], ["Vencida", "hogar"]];
  for (let i = 0; i < 3; i++) {
    const pol = must(
      await db.from("policies").insert({
        workspace_id: BRANCH_WORKSPACE_ID,
        contact_id: contactId(i + 1),
        policy_number: `QA-POL-00${i + 1}`,
        company: "QA Aseguradora",
        product: `Plan QA ${i + 1}`,
        insurance_type: polNames[i][1],
        status: polNames[i][0] === "Activa" ? "activa" : polNames[i][0] === "Vencida" ? "vencida" : "pendiente_emision",
        start_date: dateOnly(-200),
        end_date: dateOnly(i * 10 - 5),
        premium: 1200 * (i + 1),
        premium_currency: "MXN",
        payment_frequency: "mensual",
        notes: "Dato de prueba QA (branch)",
        source: "manual",
      }).select("id").single(),
      "policy",
    );
    const item = must(
      await db.from("pipeline_items").insert({ pipeline_id: polPipe.id, stage_id: polStage(polNames[i][0]), item_type: "policy", item_id: pol.id, position: 0 }).select("id").single(),
      "pipeline item policy",
    );
    must(await db.from("policies").update({ pipeline_item_id: item.id }).eq("id", pol.id), "link policy item");
    if (i < 2) {
      must(
        await db.from("policy_payments").insert({ policy_id: pol.id, due_date: dateOnly(i === 0 ? -3 : 2), amount: 1200, currency: "MXN", status: "pendiente", notes: "Cobro QA (branch)" }),
        "payment",
      );
    }
  }

  console.log("Seed QA listo en el branch: workspace, 2 cuentas, módulos, pipelines, 10 contactos, 8 oportunidades, 3 conversaciones, 4 reservas, 6 tareas, 3 pólizas, 2 cobros.");
}

main().catch((e) => {
  console.error("Seed falló:", e.message);
  process.exit(1);
});
