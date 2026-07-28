import { NextResponse, type NextRequest } from "next/server";
import { ingestMiniAppLead, isOriginAllowed } from "@/lib/miniApps/ingest";

const ALLOWED_HEADERS = "Content-Type, X-Api-Key";
const ALLOWED_METHODS = "POST, OPTIONS";

/** Public, unauthenticated-by-session endpoint (auth is the X-Api-Key
 * header, not a Supabase session — see middleware.ts, only /dashboard and
 * /select-workspace are session-gated, every /api/* route passes through).
 * CORS is real (not the `text/plain` preflight-dodge workaround) since
 * future mini apps will vary in origin — the allow-list lives on the
 * mini_apps row itself (Configuración tab), not a global env var. */
function corsHeaders(origin: string | null, allowedOrigins: string[]): HeadersInit {
  if (!origin || !isOriginAllowed(origin, allowedOrigins)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}

export async function OPTIONS(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await params;
  const origin = request.headers.get("origin");
  // The allow-list check itself happens again inside ingestMiniAppLead for
  // the real POST — OPTIONS has no API key to verify a mini app's identity
  // against yet, so this preflight response is permissive by construction
  // (browsers only use it to decide whether to even attempt the real
  // request); the POST handler is the actual enforcement point.
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

  const result = await ingestMiniAppLead({
    slug,
    apiKey: request.headers.get("x-api-key"),
    origin,
    payload,
    ip: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  const headers = corsHeaders(origin, result.allowedOrigins);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers });
  }
  return NextResponse.json({ received: true, duplicate: result.duplicate ?? false }, { status: 200, headers });
}
