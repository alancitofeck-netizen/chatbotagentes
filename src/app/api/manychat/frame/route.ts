import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { MANYCHAT_DASHBOARD_HTML } from "@/lib/manychat/dashboardTemplate";

/** Sirve el dashboard de leads de ManyChat (verbatim, sin tocar ni un byte
 * — ver el comentario al inicio de dashboardTemplate.ts), cargado dentro
 * de un <iframe> mismo-origen por src/app/manychat/page.tsx — mismo motivo
 * que Asesorías/Meeting OS y Operaciones/Herramienta 1: aislar el `window`
 * del archivo para que sus decenas de funciones/variables globales (sin
 * ningún IIFE) no choquen con el runtime de Next.js.
 *
 * Devuelve `text/html`, no JSON — no es un endpoint de datos, es la página
 * real que el iframe navega. Mismo criterio de acceso que tenía el módulo
 * anterior (cualquier rol del workspace puede verlo, gateado por
 * workspace_modules) — si no hay sesión o el módulo está desactivado,
 * redirige en vez de servir el HTML. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  const moduleStatus = await getWorkspaceModuleStatus(active.workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "manychat" && m.enabled);
  if (!enabled) return new NextResponse("Módulo no activo.", { status: 403 });

  return new NextResponse(MANYCHAT_DASHBOARD_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
