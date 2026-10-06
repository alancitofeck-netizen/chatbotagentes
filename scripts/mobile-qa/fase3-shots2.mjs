import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";
const outDir = path.resolve("docs/mobile/resultado-mobile");
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  await page.goto(`${BASE_URL}/agenda`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, "fase3-agenda-390x844.png") });
  await page.goto(`${BASE_URL}/tasks`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Abrir grupos de tareas" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "fase3-tasks-sheet-390x844.png") });
  console.log("ok");
} finally { await browser.close(); }
