// Barra inferior visible con el menú "Más" abierto (celular, cuenta QA).
// Uso: node scripts/mobile-qa/barra-con-mas.mjs  (servidor en QA_BASE_URL, por defecto :3001)
import { chromium } from "playwright";
import { ensureQaAdminUserAndPassword } from "./qaUser.mjs";
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3001";
const OUT = process.env.QA_OUT ?? "docs/mobile/barra-con-mas";
const b = await chromium.launch({ channel: "chrome", headless: true });
const { email, password } = await ensureQaAdminUserAndPassword();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${BASE}/login`); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', password); await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/login")); await p.waitForLoadState("networkidle").catch(() => {});
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
for (let i = 0; i < 4; i++) { const o = p.getByText("Omitir tutorial", { exact: true }).first(); if (!(await o.isVisible().catch(() => false))) break; await o.click().catch(() => {}); await p.waitForTimeout(400); }

const bar = p.locator("[data-mobile-bottom-nav]");
const mas = bar.getByRole("button", { name: "Más" });
// ¿El elemento que está arriba de todo en el centro de "Más" es el propio botón?
const masEncima = () => mas.evaluate((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el.contains(top); });
// El menú cerrado queda montado (opacidad 0, inert) para animar: "abierto" = sin inert.
const menuAbierto = () => p.getByPlaceholder("Buscar sección").evaluate((el) => !el.closest("[inert]"));
const out = {};

await mas.click(); await p.waitForTimeout(500);
out.abierto_menuVisible = await menuAbierto();
out.abierto_barraEncima = await masEncima();
out.abierto_masExpandido = await mas.getAttribute("aria-expanded");
await p.screenshot({ path: `${OUT}-abierto.png` });
// Último ítem del menú: tiene que poder verse completo por encima de la barra.
await p.getByRole("button", { name: /Cerrar sesión/ }).scrollIntoViewIfNeeded();
const ultimo = await p.getByRole("button", { name: /Cerrar sesión/ }).boundingBox();
const barTop = (await bar.boundingBox()).y;
out.abierto_ultimoItemNoTapado = ultimo.y + ultimo.height <= barTop;
await p.screenshot({ path: `${OUT}-abierto-final.png` });

await mas.click(); await p.waitForTimeout(500);
out.cerradoConMas_menuVisible = await menuAbierto();
out.cerradoConMas_masExpandido = await mas.getAttribute("aria-expanded");

await mas.click(); await p.waitForTimeout(500);
await bar.getByRole("link", { name: "Agenda" }).click();
await p.waitForURL((u) => u.pathname.startsWith("/agenda")); await p.waitForTimeout(800);
out.irAAgenda_menuVisible = await menuAbierto();
out.irAAgenda_url = new URL(p.url()).pathname;
await p.screenshot({ path: `${OUT}-agenda.png` });

console.log(JSON.stringify({ ...out, errors }, null, 1));
await b.close();
