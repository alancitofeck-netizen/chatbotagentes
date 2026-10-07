// Guarda un link de hoja en /manychat SIN que exista la conexión previa de ManyChat y verifica la fila.
// Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/manychat-guardar-hoja.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { ensureQaAdminUserAndPassword, QA_WORKSPACE_ID } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const row = async () => (await db.from("integration_connections").select("status, webhook_secret, metadata").eq("workspace_id", QA_WORKSPACE_ID).eq("provider", "manychat").maybeSingle()).data;
await db.from("integration_connections").delete().eq("workspace_id", QA_WORKSPACE_ID).eq("provider", "manychat");
const antes = await row();
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaAdminUserAndPassword();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
await p.goto(`${BASE}/manychat`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const conectar = await p.getByText("Conectá tu hoja de ManyChat").isVisible();
await p.getByPlaceholder("https://docs.google.com/spreadsheets/d/…").fill("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0");
await p.getByRole("button", { name: "Guardar hoja" }).click();
await p.waitForTimeout(6000);
const texto = await p.locator("body").innerText();
const despues = await row();
console.log(JSON.stringify({
  conectar, filaAntes: antes, filaDespues: despues,
  dijoPrimeroConecta: texto.includes("Primero conectá"),
  dijoGuardada: texto.includes("Hoja guardada") || texto.includes("No pudimos leer la hoja"),
}, null, 1));
await db.from("integration_connections").delete().eq("workspace_id", QA_WORKSPACE_ID).eq("provider", "manychat"); // limpieza
await b.close();
