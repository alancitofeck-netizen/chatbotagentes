import fs from "node:fs";
import path from "node:path";
import { launch, loginIn, BASE_URL } from "./session.mjs";

const ROUTES = ["/dashboard", "/crm", "/inbox", "/agenda", "/tasks"];
const outDir = path.resolve(process.argv[2]);
const width = Number(process.argv[3] ?? 1440);
const height = Number(process.argv[4] ?? 900);
fs.mkdirSync(outDir, { recursive: true });

const { browser, context } = await launch({ width, height });
try {
  const page = await loginIn(context);
  for (const route of ROUTES) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    for (let k = 0; k < 4; k++) {
      const skip = page.getByText("Omitir tutorial", { exact: true }).first();
      if (!(await skip.isVisible().catch(() => false))) break;
      await skip.click().catch(() => {});
      await page.waitForTimeout(600);
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    const name = route.slice(1).replace(/\//g, "_") + `-${width}x${height}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: false });
    console.log("saved", name, "->", new URL(page.url()).pathname);
  }
} finally {
  await browser.close();
}
