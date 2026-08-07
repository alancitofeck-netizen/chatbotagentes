import { NextResponse, type NextRequest } from "next/server";
import { ingestMiniAppLeadFromHostedPage } from "@/lib/miniApps/ingest";

/** Equivalente a submitMiniAppLeadFromHostedPage (miniApps/actions.ts) pero
 * expuesto como Route Handler en vez de Server Action — necesario para
 * "Diagnóstico Interactivo Financiero" (src/app/apps/[slug]/
 * diagnosticoTemplate.ts), cuyo cliente es JS vanilla inyectado y no puede
 * invocar un Server Action (eso requiere el protocolo interno de Next.js,
 * solo disponible para código que forma parte del árbol React). Mismo
 * posture "same-origin, sin API key" — delega en la misma función que ya
 * usa el Server Action, cero lógica de negocio nueva. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ received: true, duplicate: result.duplicate ?? false, leadId: result.leadId ?? null });
}
