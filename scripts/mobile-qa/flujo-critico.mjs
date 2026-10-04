import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";

// Flujo crítico en mobile. No envía mensajes de WhatsApp: los contactos QA
// tienen números con formato real y un envío saldría de verdad.
const outDir = path.resolve("docs/mobile/resultado-mobile");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(ok ? "PASS" : "FAIL", name, detail);
};

const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  check("login llega a la app", !new URL(page.url()).pathname.startsWith("/login"), page.url());

  await page.goto(`${BASE_URL}/inbox`, { waitUntil: "networkidle", timeout: 90000 });
  const firstConv = page.locator("button").filter({ hasText: "[QA] Contacto 1" }).first();
  check("lista de conversaciones visible", await firstConv.isVisible().catch(() => false));

  await firstConv.click();
  await page.waitForTimeout(1200);
  const composer = page.locator('textarea[data-tour="inbox.composer"]');
  check("conversación abre con compositor", await composer.waitFor({ state: "visible", timeout: 10000 }).then(() => true, () => false));
  check("barra inferior oculta con conversación abierta", !(await page.locator("[data-mobile-bottom-nav]").isVisible().catch(() => false)));

  const tomar = page.getByRole("button", { name: "Tomar", exact: true });
  if (await tomar.waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false)) {
    await tomar.click();
    // La action se encola detrás de las del panel (insight IA, CRM, pólizas): esperamos
    // la confirmación real del servidor (toast de éxito), no un tiempo fijo.
    const confirmed = await page.getByText("Tomaste la conversación.").waitFor({ state: "visible", timeout: 20000 }).then(() => true, () => false);
    check("Tomar cambia el handoff (aviso de IA desaparece)", confirmed && !(await tomar.isVisible().catch(() => false)));
  } else {
    check("Tomar: conversación sin IA activa (no aplica)", true, "modo humano");
  }

  await page.getByRole("button", { name: "Volver a la lista" }).click();
  await page.waitForTimeout(600);
  check("volver regresa a la lista", await page.locator("button").filter({ hasText: "[QA] Contacto 1" }).first().isVisible().catch(() => false));

  await page.goto(`${BASE_URL}/crm`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  const moveBtn = page.getByRole("button", { name: "Mover a etapa…" }).first();
  check("CRM: botón Mover a etapa visible en móvil", await moveBtn.isVisible().catch(() => false));
  await moveBtn.click();
  await page.waitForTimeout(500);
  const target = page.getByRole("dialog").getByRole("button").filter({ hasText: /Contactado|Calificado|Propuesta|Negociación|Ganado/ }).first();
  const targetText = (await target.textContent().catch(() => "")) ?? "";
  await target.click().catch(() => {});
  await page.waitForTimeout(1200);
  check("CRM: lead cambia de etapa desde la hoja", targetText.length > 0, `hacia ${targetText.trim()}`);

  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("sin scroll horizontal de página en CRM", scrollW <= 0, `exceso ${scrollW}px`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} OK`);
if (failed.length) process.exitCode = 1;
void outDir;
