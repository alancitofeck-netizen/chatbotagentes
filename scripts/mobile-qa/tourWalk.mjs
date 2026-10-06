import { launch, loginIn, BASE_URL, skipTours } from "./session.mjs";
const routes = { inbox: "/inbox", crm: "/crm", dashboard: "/dashboard", agenda: "/agenda", tasks: "/tasks", calendar: "/calendar", polizas: "/polizas", cobranza: "/cobranza", asesorias: "/asesorias", documents: "/documents", profile: "/profile" };
const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(routes);
const { browser, context } = await launch({ width: 390, height: 844 });
const report = {};
try {
  const page = await loginIn(context, "admin");
  for (const name of names) {
    await page.goto(`${BASE_URL}${routes[name]}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    await skipTours(page);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    const helpBtn = page.getByRole("button", { name: /Qué hago/ }).first();
    if (!(await helpBtn.isVisible().catch(() => false))) { report[name] = "sin ayuda"; continue; }
    const opened = await helpBtn.click({ timeout: 5000 }).then(() => true, () => false);
    if (!opened) { report[name] = "bloqueado: el botón de ayuda no es clicable (overlay)"; continue; }
    await page.waitForTimeout(500);
    const again = page.getByRole("button", { name: "Volver a ver tutorial" });
    if (!(await again.isVisible().catch(() => false))) { report[name] = "sin tour"; continue; }
    await again.click();
    const steps = [];
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(900);
      const s = await page.evaluate(() => {
        const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
        if (!dlg) return null;
        const r = dlg.getBoundingClientRect();
        const spot = document.querySelector("[data-tour-spotlight], .tour-spotlight, [class*='spotlight']");
        return {
          text: dlg.innerText.split("\n").filter(Boolean)[0]?.slice(0, 60),
          offscreen: r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1,
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          spot: !!spot,
        };
      });
      if (!s) break;
      steps.push(s);
      const next = page.getByRole("button", { name: /Siguiente|Finalizar|Entendido|Listo/ }).last();
      if (!(await next.isVisible().catch(() => false))) break;
      const label = (await next.innerText().catch(() => "")).trim();
      if (/Finalizar|Entendido|Listo/.test(label)) { steps.push({ end: label }); break; }
      const clicked = await next.click({ timeout: 4000 }).then(() => true, () => false);
      if (!clicked) { steps.push({ text: "BOTON SIGUIENTE FUERA DE PANTALLA", offscreen: true, rect: [], spot: false }); break; }
    }
    report[name] = steps;
    await page.keyboard.press("Escape").catch(() => {});
  }
} finally { await browser.close(); }
for (const [k, v] of Object.entries(report)) {
  if (typeof v === "string") { console.log(k, v); continue; }
  const bad = v.filter((s) => s.offscreen);
  console.log(`${k}: ${v.length} pasos, fuera de pantalla ${bad.length}`);
  for (const s of v) console.log("   ", s.offscreen ? "!!" : "  ", s.text ?? JSON.stringify(s), s.rect ? JSON.stringify(s.rect) : "");
}
