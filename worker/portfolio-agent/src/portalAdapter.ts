import type { Page } from "playwright";

/** Nunca cookies/tokens/passwords acá — solo lo que el adapter necesita
 * para loguearse, resuelto por el caller vía `get_portal_credentials`. */
export interface PortalCredentials {
  username: string;
  password: string;
  portalUrl: string;
}

/** Estructura común de una póliza tal como sale del portal, ANTES de
 * normalizar/matchear con el CRM (eso lo hace Growth Link al recibir el
 * webhook `policy_extracted`, no el worker). Campos ausentes = null, nunca
 * inventados (pedido explícito del usuario). `raw` es metadata de debugging
 * acotada — jamás credenciales/cookies/tokens. */
export interface PortalPolicyRaw {
  externalId: string;
  policyNumber: string | null;
  clientName: string | null;
  /** DNI/CUIT u otro documento — lo que el portal muestre como identidad del cliente. */
  clientDocument: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  product: string | null;
  policyType: string | null;
  premium: number | null;
  premiumCurrency: string | null;
  paymentFrequency: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  status: string | null;
  raw: Record<string, unknown>;
}

export interface PortalAdapterLimits {
  timeoutMs: number;
  maxPages: number;
  maxPolicies: number;
  maxRetries: number;
  delayMs: number;
}

export const DEFAULT_LIMITS: PortalAdapterLimits = {
  timeoutMs: 30_000,
  maxPages: 50,
  maxPolicies: 2000,
  maxRetries: 3,
  delayMs: 1500,
};

export interface PortalAdapterContext {
  page: Page;
  credentials: PortalCredentials;
  limits: PortalAdapterLimits;
}

export type LoginResult = { ok: true } | { ok: false; requiresUserAction?: string; error?: string };

/** Interfaz que cada portal implementa — mismo espíritu que `WhatsAppService`
 * en worker/whatsapp-connector (jobManager.ts no sabe nada de Playwright ni
 * de ningún portal puntual, solo de esta interfaz). Un adapter nunca intenta
 * evadir CAPTCHA/MFA (sección 10 del pedido del usuario) — si el login se
 * interrumpe por un paso de verificación, devuelve `requiresUserAction` en
 * vez de forzar nada. */
export interface PortalAdapter {
  readonly key: string;
  login(ctx: PortalAdapterContext): Promise<LoginResult>;
  navigateToPolicies(ctx: PortalAdapterContext): Promise<void>;
  getPolicyList(ctx: PortalAdapterContext): Promise<PortalPolicyRaw[]>;
  getPolicyDetails(ctx: PortalAdapterContext, policy: PortalPolicyRaw): Promise<PortalPolicyRaw>;
  hasNextPage(ctx: PortalAdapterContext): Promise<boolean>;
  nextPage(ctx: PortalAdapterContext): Promise<void>;
  logout(ctx: PortalAdapterContext): Promise<void>;
}
