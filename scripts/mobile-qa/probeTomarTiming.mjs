import { launch, loginIn, BASE_URL } from "./session.mjs";
const { browser, context } = await launch({ width: 390, height: 844 });
try {
  const page = await loginIn(context, "admin");
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  const t0 = Date.now(); const log = [];
  page.on("request", (r) => { const a = r.headers()["next-action"]; if (a) log.push(`${Date.now() - t0}ms ${a.slice(0, 6)}`); });
  await page.locator("button").filter({ hasText: "[QA] Contacto 1" }).first().click();
  const tomar = page.getByRole("button", { name: "Tomar", exact: true });
  await tomar.waitFor({ state: "visible", timeout: 10000 });
  const clickAt = Date.now() - t0;
  await tomar.click();
  await page.getByText("Tomaste la conversación.").waitFor({ state: "visible", timeout: 20000 });
  console.log("click at", clickAt, "ms; toast at", Date.now() - t0, "ms");
  console.log(log.join("\n"));
} finally { await browser.close(); }
