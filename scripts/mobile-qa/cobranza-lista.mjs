// Prueba la lista móvil de /cobranza: grupos, "Recordar" (link a WhatsApp) y "Cobrado" (abre el detalle para registrar el pago).
// Uso: QA_TARGET=branch node scripts/qa/branch.mjs node scripts/mobile-qa/cobranza-lista.mjs
import { chromium } from "playwright";
import { ensureQaUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaUserAndPassword();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
await p.goto(`${BASE}/cobranza`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }
const grupos = await p.locator("section[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const recordar = p.getByRole("link", { name: "Recordar" }).first();
const href = (await recordar.getAttribute("href")) ?? "";
await p.getByRole("button", { name: "Cobrado", exact: true }).first().click();
await p.waitForTimeout(1500);
await p.screenshot({ path: process.env.DBG ?? 'dbg.png' });
const drawer = await p.getByText("Cobro", { exact: true }).first().isVisible().catch(() => false);
console.log(JSON.stringify({ grupos, recordarEsWhatsApp: href.startsWith("https://wa.me/"), abrioDetalle: drawer, errors }));
await b.close();
