import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const routes = [
  ["asesores-performance", "/asesores/performance"],
  ["asesores-agendas", "/asesores/agendas"],
  ["polizas-tabla", "/polizas?view=tabla"],
  ["cobranza", "/cobranza"],
  ["tareas-tabla", "/tasks?view=tabla"],
  ["crm-lista", "/crm?view=lista"],
];
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  for (const [name, route] of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1200);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const status = await page.evaluate(() => (document.body.innerText.match(/Error|no encontrada|Not Found/) || [""])[0]);
    await page.screenshot({ path: path.join(outDir, `fase4-${name}-390x844.png`) });
    console.log(name, "hscroll", scrollW, "flag", status || "-");
  }
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.waitForTimeout(400);
  await page.keyboard.type("Contacto");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "fase4-buscar-390x844.png") });
  console.log("search ok");
} finally { await browser.close(); }
