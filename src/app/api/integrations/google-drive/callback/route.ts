import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { connectGoogleDrive } from "@/lib/integrations/googleDrive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const target = new URL("/profile", request.url);
  target.searchParams.set("tab", "integrations");

  if (oauthError || !code || !state) {
    target.searchParams.set("google_drive_error", "1");
    return NextResponse.redirect(target);
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active || active.workspaceId !== state) {
    target.searchParams.set("google_drive_error", "1");
    return NextResponse.redirect(target);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-drive/callback`;
    await connectGoogleDrive(active.workspaceId, code, redirectUri);
    target.searchParams.set("google_drive_connected", "1");
  } catch (err) {
    console.error("[google-drive callback] connection failed:", err);
    target.searchParams.set("google_drive_error", "1");
  }

  return NextResponse.redirect(target);
}
