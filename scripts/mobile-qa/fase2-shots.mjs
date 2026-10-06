import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, "fase2-mas-390x844.png") });
  await page.getByRole("button", { name: "Cerrar menú" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.waitForTimeout(500);
  await page.keyboard.type("Contacto");
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, "fase2-buscar-390x844.png") });
  console.log("ok");
} finally { await browser.close(); }
