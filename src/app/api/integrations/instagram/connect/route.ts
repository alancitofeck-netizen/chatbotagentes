import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getInstagramAuthUrl } from "@/lib/integrations/instagram";

/** Inicia el flujo OAuth de Instagram — calco exacto de
 * google-calendar/connect/route.ts. `state` lleva el workspace id para que
 * el callback confirme que sigue siendo el mismo workspace. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/instagram/callback`;
    const authUrl = getInstagramAuthUrl(redirectUri, active.workspaceId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[instagram connect] failed to build auth URL:", err);
    const target = new URL("/profile", request.url);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("instagram_error", "1");
    return NextResponse.redirect(target);
  }
}
