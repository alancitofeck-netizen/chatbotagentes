import { chromium, type Browser, type Page } from "playwright";

/** Un solo Browser compartido, un BrowserContext AISLADO por job — mismo
 * criterio de aislamiento que whatsapp-connector (una sesión = un Client
 * propio), pero acá el aislamiento es por CONTEXT en vez de por Browser
 * completo, porque lanzar un browser entero por job sería mucho más caro y
 * un BrowserContext ya da cookies/storage completamente separados (nunca
 * comparte sesión entre workspaces, pedido explícito sección 11). */
let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return sharedBrowser;
}

/** Corre `fn` con una página en un context nuevo y aislado, garantizando el
 * cierre (y por lo tanto la limpieza de cookies/storage temporal) pase lo
 * que pase adentro — sección 11 del pedido: "cuando termina una sesión,
 * cerrar navegador, limpiar contexto, no persistir datos innecesarios". */
export async function withIsolatedPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    return await fn(page);
  } finally {
    await context.close();
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}
