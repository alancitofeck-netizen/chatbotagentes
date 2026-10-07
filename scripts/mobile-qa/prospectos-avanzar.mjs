// Prueba "Avanzar etapa" en /advisors (uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/prospectos-avanzar.mjs [nombre])
import { chromium } from "playwright";
import { ensureQaUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const nombre = (process.argv[2] ?? "Andrés_Molina").replace(/_/g, " ");
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaUserAndPassword();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
await p.goto(`${BASE}/advisors`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const headers = async () => (await p.locator("body").innerText()).match(/(Nuevo|Contactado|Propuesta|Cliente|Perdido)\s+\d+/g);
const antes = await headers();
// la tarjeta de ese prospecto: sube hasta el contenedor que tiene el botón
const card = p.locator("div", { has: p.getByText(nombre, { exact: true }) }).filter({ has: p.getByRole("button", { name: "Avanzar etapa" }) }).last();
const btn = card.getByRole("button", { name: "Avanzar etapa" });
const habia = await btn.count();
await btn.click({ timeout: 8000 }).catch(async (e) => { await p.screenshot({ path: process.env.DBG ?? "dbg.png" }); console.log("click fallo:", String(e.message).split(String.fromCharCode(10))[0]); });
await p.waitForTimeout(8000);
const despues = await headers();
console.log(JSON.stringify({ nombre, botonVisible: habia, antes, despues, errors }));
await b.close();
