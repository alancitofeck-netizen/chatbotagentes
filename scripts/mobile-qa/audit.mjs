import fs from "node:fs";
import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";

const ROUTES = [
  "/advisors", "/advisors/import", "/agenda", "/agentes-ia", "/agentes-ia/nuevo", "/analizador-cartera",
  "/aseguradoras", "/asesores", "/asesores/agendas", "/asesores/operaciones", "/asesores/performance",
  "/asesorias", "/asesorias/cierre", "/asesorias/presentacion", "/asesorias/referidos", "/asistente",
  "/ats", "/automations", "/automatizaciones", "/calendar", "/classroom", "/classroom/admin", "/cobranza",
  "/crm", "/dashboard", "/documents", "/extraccion-polizas", "/importar-exportar", "/inbox",
  "/inbox/contactos", "/inbox/etiquetas", "/inbox/plantillas", "/kpis", "/metas", "/mini-apps",
  "/operaciones", "/polizas", "/polizas/posibles-polizas", "/presentaciones", "/profile", "/settings",
  "/tasks", "/tasks/agenda", "/tasks/archived", "/tasks/favorites",
];

const outArg = process.argv[2] ?? "docs/mobile-shots";
const width = Number(process.argv[3] ?? 390);
const height = Number(process.argv[4] ?? 844);
const doShots = process.argv[5] !== "noshots";
const account = process.argv[6] ?? "agent";
const outDir = path.resolve(outArg);
fs.mkdirSync(outDir, { recursive: true });

// Mide en el DOM real (no en el código) — por eso se corre contra la app viva.
const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const doc = { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().replace(/\\s+/g, " ").slice(0, 60);
  const overflowing = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) overflowing.push({ tag: el.tagName, label: label(el), right: Math.round(r.right) });
  });
  const smallTargets = [];
  document.querySelectorAll("button, a[href], [role=button], input[type=checkbox], input[type=radio], [role=tab]").forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) smallTargets.push({ tag: el.tagName, label: label(el), w: Math.round(r.width), h: Math.round(r.height) });
  });
  const smallInputs = [];
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    if (!visible(el) || el.type === "hidden" || el.type === "checkbox" || el.type === "radio") return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) smallInputs.push({ tag: el.tagName, name: el.name || el.id || label(el), font: fs });
  });
  const wideTables = [];
  document.querySelectorAll("table").forEach((t) => {
    if (!visible(t)) return;
    const r = t.getBoundingClientRect();
    const wrap = t.parentElement;
    const contained = wrap && getComputedStyle(wrap).overflowX !== "visible";
    if (r.width > vw + 1 || (t.scrollWidth > t.parentElement.clientWidth + 1 && !contained)) wideTables.push({ width: Math.round(r.width) });
  });
  const hoverOnly = [];
  document.querySelectorAll("[class*='group-hover:opacity-0'], [class*='group-hover:flex'], [class*='group-hover:block'], [class*='hover:opacity-100']").forEach((el) => {
    if (visible(el)) hoverOnly.push({ tag: el.tagName, label: label(el) });
  });
  const fixedPx = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (!visible(el)) return;
    const st = el.getAttribute("style") || "";
    const m = st.match(/width:\\s*(\\d+)px/);
    if (m && Number(m[1]) > vw - 16) fixedPx.push({ tag: el.tagName, label: label(el), width: Number(m[1]) });
  });
  return { vw, doc, overflowing: overflowing.slice(0, 15), overflowCount: overflowing.length,
    smallTargets: smallTargets.slice(0, 25), smallTargetCount: smallTargets.length,
    smallInputs: smallInputs.slice(0, 15), smallInputCount: smallInputs.length,
    wideTables: wideTables.length, hoverOnlyCount: hoverOnly.length, hoverOnly: hoverOnly.slice(0, 10),
    fixedPx: fixedPx.slice(0, 10) };
})()`;

const { browser, context } = await launch({ width, height });
const results = [];
try {
  const page = await loginIn(context, account);
  for (const route of ROUTES) {
    const entry = { route };
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      entry.landed = new URL(page.url()).pathname;
      entry.measure = await page.evaluate(MEASURE);
      if (doShots) {
        const name = (route === "/" ? "home" : route.slice(1).replace(/\//g, "_")) + `-${width}.png`;
        await page.screenshot({ path: path.join(outDir, name), fullPage: true });
        entry.shot = name;
      }
    } catch (e) {
      entry.error = e.message.slice(0, 200);
    }
    results.push(entry);
    console.log(route, entry.error ? "ERROR" : `scrollW=${entry.measure.doc.scrollWidth}/${entry.measure.vw} overflow=${entry.measure.overflowCount} smallTargets=${entry.measure.smallTargetCount} smallInputs=${entry.measure.smallInputCount} hoverOnly=${entry.measure.hoverOnlyCount} tables=${entry.measure.wideTables}`);
  }
} finally {
  fs.writeFileSync(path.join(outDir, `audit-${width}-${account}.json`), JSON.stringify(results, null, 2));
  await browser.close();
}
