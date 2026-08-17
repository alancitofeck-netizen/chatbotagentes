import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { HERRAMIENTA_1_HTML } from "@/lib/operaciones/tool1Template";

/** Sirve el documento HTML completo de "Growth Link OS" (verbatim, sin
 * tocar ni un byte — ver el comentario al inicio de tool1Template.ts),
 * cargado dentro de un <iframe> mismo-origen por
 * src/app/operaciones/[tool]/page.tsx — mismo motivo que Asesorías/Meeting
 * OS: aislar el `window` del archivo para que sus 100+ funciones globales
 * (sin ningún IIFE) no choquen con el runtime de Next.js. A diferencia de
 * Meeting OS, esta herramienta administra 100% su propio estado vía
 * localStorage — no hay ningún shim de pre-siembra ni sync a Supabase acá.
 *
 * Devuelve `text/html`, no JSON — no es un endpoint de datos, es la página
 * real que el iframe navega. Sesión inválida o rol insuficiente redirigen a
 * /login (mismo criterio que asesorias/[id]/frame/route.ts) — en la
 * práctica esto casi nunca dispara porque la página contenedora ya exige
 * owner/admin antes de montar el <iframe>. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  if (active.role !== "owner" && active.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await assertModuleEnabled(active.workspaceId, "operaciones");
  } catch {
    return new NextResponse("Módulo no activo.", { status: 403 });
  }

  return new NextResponse(HERRAMIENTA_1_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
