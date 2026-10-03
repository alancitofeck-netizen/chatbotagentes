import { chromium } from "playwright";
import { ensureQaUserAndPassword, ensureQaAdminUserAndPassword } from "./qaUser.mjs";

export const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3001";

export async function launch(viewport) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: viewport.width < 768,
    hasTouch: viewport.width < 768,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    reducedMotion: "reduce",
  });
  return { browser, context };
}

export async function loginIn(context, account = "agent") {
  const { email, password } = account === "admin" ? await ensureQaAdminUserAndPassword() : await ensureQaUserAndPassword();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60000 });
  if (new URL(page.url()).pathname.startsWith("/select-workspace")) {
    await page.waitForURL((url) => !url.pathname.startsWith("/select-workspace"), { timeout: 60000 }).catch(() => {});
  }
  return page;
}
