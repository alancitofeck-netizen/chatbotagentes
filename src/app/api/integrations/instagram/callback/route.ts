import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { connectInstagram } from "@/lib/integrations/instagram";

/** Calco exacto de google-calendar/callback/route.ts. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const target = new URL("/profile", request.url);
  target.searchParams.set("tab", "integrations");

  if (oauthError || !code || !state) {
    target.searchParams.set("instagram_error", "1");
    return NextResponse.redirect(target);
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  // `state` debe coincidir con el workspace activo actual — evita vincular
  // Instagram a un workspace distinto del que arrancó el flujo.
  if (!active || active.workspaceId !== state) {
    target.searchParams.set("instagram_error", "1");
    return NextResponse.redirect(target);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/instagram/callback`;
    await connectInstagram(active.workspaceId, code, redirectUri);
    target.searchParams.set("instagram_connected", "1");
  } catch (err) {
    console.error("[instagram callback] connection failed:", err);
    target.searchParams.set("instagram_error", "1");
  }

  return NextResponse.redirect(target);
}
