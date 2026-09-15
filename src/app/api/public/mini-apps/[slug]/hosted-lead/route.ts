import { NextResponse, type NextRequest } from "next/server";
import { ingestMiniAppLeadFromHostedPage, isOriginAllowed } from "@/lib/miniApps/ingest";

const ALLOWED_HEADERS = "Content-Type";
const ALLOWED_METHODS = "POST, OPTIONS";

/** Equivalente a submitMiniAppLeadFromHostedPage (miniApps/actions.ts) pero
 * expuesto como Route Handler en vez de Server Action — necesario para
 * "Diagnóstico Interactivo Financiero" (src/app/apps/[slug]/
 * diagnosticoTemplate.ts), cuyo cliente es JS vanilla inyectado y no puede
 * invocar un Server Action (eso requiere el protocolo interno de Next.js,
 * solo disponible para código que forma parte del árbol React). Mismo
 * posture "same-origin, sin API key" — delega en la misma función que ya
 * usa el Server Action, cero lógica de negocio nueva.
 *
 * CORS: también lo usa un bundle "Vincular App" alojado (hostingMode
 * "upload"), servido dentro de un iframe sandboxeado sin allow-same-origin
 * (LinkedAppLanding.tsx) — ese iframe tiene origen opaco ("null") y
 * cualquier fetch con Content-Type: application/json dispara un preflight
 * OPTIONS real (no es un "simple request"). Sin un handler OPTIONS acá, el
 * navegador nunca llega a mandar el POST y el lead se pierde en silencio —
 * confirmado en vivo: un POST directo (curl, sin preflight) insertaba bien,
 * pero el mismo formulario dentro del iframe real no. Mismo patrón de CORS
 * que ya usa el otro endpoint público (leads/route.ts): el OPTIONS es
 * permisivo por construcción (sin allowed_origins todavía resueltos), y el
 * POST solo hace eco del Origin si allowed_origins de esa mini app
 * específica lo permite (bundle-upload/route.ts ya agrega "null" ahí para
 * todo bundle alojado). */
export async function OPTIONS(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await params;
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: origin
      ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": ALLOWED_METHODS, "Access-Control-Allow-Headers": ALLOWED_HEADERS, "Access-Control-Max-Age": "86400" }
      : {},
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = request.headers.get("origin");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await ingestMiniAppLeadFromHostedPage(
    slug,
    payload,
    request.headers.get("x-forwarded-for"),
    request.headers.get("user-agent"),
  );

  const headers: HeadersInit = origin && isOriginAllowed(origin, result.allowedOrigins) ? { "Access-Control-Allow-Origin": origin } : {};
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers });
  }
  return NextResponse.json({ received: true, duplicate: result.duplicate ?? false, leadId: result.leadId ?? null }, { headers });
}
