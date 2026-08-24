import type { PortalAdapter, PortalAdapterContext, PortalPolicyRaw, LoginResult } from "../../portalAdapter.js";

/** Único adapter de esta pasada — NO es un adapter real de ninguna
 * aseguradora (GNP/MetLife/etc. necesitan el flujo/URL/capturas reales del
 * portal, que el usuario todavía no dio — sección 61 del pedido: "no
 * inventes cómo funciona un portal específico"). Sirve para probar el
 * pipeline completo (login → navegación → extracción → paginación) contra
 * cualquier página de prueba simple: un form de login (usuario, contraseña,
 * submit) y una tabla HTML de pólizas con un link/botón "Siguiente"/"Next"
 * de paginación.
 *
 * Usa locators por rol/label/texto visible (`getByLabel`/`getByRole`),
 * nunca clases CSS generadas — pedido explícito, sección 62 ("priorizar
 * accesibilidad, roles, labels, texto visible... evitar depender
 * exclusivamente de clases CSS"). Un adapter real de un portal específico
 * puede necesitar selectores más finos si el portal no expone roles/labels
 * accesibles, pero el punto de partida siempre debería ser este. */
export class GenericTestAdapter implements PortalAdapter {
  readonly key = "generic_test";

  async login(ctx: PortalAdapterContext): Promise<LoginResult> {
    const { page, credentials, limits } = ctx;
    await page.goto(credentials.portalUrl, { timeout: limits.timeoutMs });

    const usernameField = page.getByLabel(/usuario|user|email/i).or(page.locator('input[type="text"], input[type="email"]').first());
    const passwordField = page.getByLabel(/contraseñ|password/i).or(page.locator('input[type="password"]').first());

    if ((await usernameField.count()) === 0 || (await passwordField.count()) === 0) {
      return { ok: false, error: "No se encontró un formulario de login reconocible en la página." };
    }

    await usernameField.first().fill(credentials.username);
    await passwordField.first().fill(credentials.password);

    const submitButton = page.getByRole("button", { name: /iniciar sesi|ingresar|login|sign in/i }).or(page.locator('button[type="submit"], input[type="submit"]').first());
    await submitButton.first().click();
    await page.waitForLoadState("networkidle", { timeout: limits.timeoutMs }).catch(() => undefined);

    // MFA/CAPTCHA/verificación adicional — nunca se intenta evadir (sección
    // 10 del pedido). Si después de enviar el form seguimos viendo un campo
    // de contraseña visible, algo interrumpió el login (credenciales
    // incorrectas o un paso de verificación manual) y el job se detiene
    // pidiendo intervención en vez de reintentar a ciegas.
    const stillOnLogin = (await passwordField.count()) > 0 && (await passwordField.first().isVisible().catch(() => false));
    if (stillOnLogin) {
      return { ok: false, requiresUserAction: "El portal pidió un paso de verificación adicional (MFA/CAPTCHA) o rechazó las credenciales — completalo manualmente y reintentá." };
    }
    return { ok: true };
  }

  async navigateToPolicies(ctx: PortalAdapterContext): Promise<void> {
    // La página de prueba genérica ya muestra la tabla en la misma vista
    // post-login. Un adapter real de una aseguradora puntual navegaría acá
    // a la sección de cartera/pólizas (sección 13 del pedido).
    await ctx.page.waitForSelector("table", { timeout: ctx.limits.timeoutMs }).catch(() => undefined);
  }

  async getPolicyList(ctx: PortalAdapterContext): Promise<PortalPolicyRaw[]> {
    const rows = await ctx.page.locator("table tbody tr").all();
    const policies: PortalPolicyRaw[] = [];
    for (const row of rows) {
      const cells = await row.locator("td").allTextContents();
      const externalId = cells[0]?.trim();
      if (!externalId) continue;
      policies.push({
        externalId,
        policyNumber: externalId,
        clientName: cells[1]?.trim() || null,
        clientDocument: cells[2]?.trim() || null,
        clientEmail: null,
        clientPhone: null,
        product: cells[3]?.trim() || null,
        policyType: null,
        premium: null,
        premiumCurrency: null,
        paymentFrequency: null,
        startDate: null,
        endDate: null,
        renewalDate: null,
        status: cells[4]?.trim() || null,
        raw: { cells },
      });
    }
    return policies;
  }

  async getPolicyDetails(_ctx: PortalAdapterContext, policy: PortalPolicyRaw): Promise<PortalPolicyRaw> {
    // La página de prueba no tiene vista de detalle propia. Un adapter real
    // abriría acá "Ver detalle" y enriquecería los campos que solo estén
    // disponibles ahí (sección 15 del pedido).
    return policy;
  }

  async hasNextPage(ctx: PortalAdapterContext): Promise<boolean> {
    const next = ctx.page.getByRole("link", { name: /siguiente|next/i }).or(ctx.page.getByRole("button", { name: /siguiente|next/i }));
    if ((await next.count()) === 0) return false;
    return next.first().isEnabled().catch(() => false);
  }

  async nextPage(ctx: PortalAdapterContext): Promise<void> {
    const next = ctx.page.getByRole("link", { name: /siguiente|next/i }).or(ctx.page.getByRole("button", { name: /siguiente|next/i }));
    await next.first().click();
    await ctx.page.waitForLoadState("networkidle", { timeout: ctx.limits.timeoutMs }).catch(() => undefined);
  }

  async logout(ctx: PortalAdapterContext): Promise<void> {
    const logoutControl = ctx.page.getByRole("link", { name: /cerrar sesi|logout|sign out/i }).or(ctx.page.getByRole("button", { name: /cerrar sesi|logout|sign out/i }));
    if ((await logoutControl.count()) > 0) {
      await logoutControl.first().click().catch(() => undefined);
    }
  }
}
