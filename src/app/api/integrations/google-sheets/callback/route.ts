import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { connectGoogleSheets } from "@/lib/integrations/googleSheets";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const target = new URL("/profile", request.url);
  target.searchParams.set("tab", "integrations");

  if (oauthError || !code || !state) {
    target.searchParams.set("google_sheets_error", "1");
    return NextResponse.redirect(target);
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active || active.workspaceId !== state) {
    target.searchParams.set("google_sheets_error", "1");
    return NextResponse.redirect(target);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-sheets/callback`;
    await connectGoogleSheets(active.workspaceId, code, redirectUri);
    target.searchParams.set("google_sheets_connected", "1");
  } catch (err) {
    console.error("[google-sheets callback] connection failed:", err);
    target.searchParams.set("google_sheets_error", "1");
  }

  return NextResponse.redirect(target);
}
