import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { HERRAMIENTA_2_HTML } from "@/lib/operaciones/tool2Template";

/** Sirve el documento HTML completo de "Growth Link Map" (verbatim, sin
 * tocar ni un byte — ver el comentario al inicio de tool2Template.ts). Mismo
 * criterio exacto que /api/operaciones/herramienta-1/frame: iframe
 * mismo-origen, sin shim (la herramienta administra 100% su propio estado
 * vía localStorage), sesión inválida o rol insuficiente redirigen/bloquean
 * igual que esa ruta. */
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

  return new NextResponse(HERRAMIENTA_2_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
