import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getGoogleDriveAuthUrl } from "@/lib/integrations/googleDrive";

/** Starts the Google Drive OAuth2 flow — mirrors
 * src/app/api/integrations/google-sheets/connect/route.ts exactly, just a
 * different provider/scope (drive.readonly instead of spreadsheets.readonly). */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-drive/callback`;
    const authUrl = getGoogleDriveAuthUrl(redirectUri, active.workspaceId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[google-drive connect] failed to build auth URL:", err);
    const target = new URL("/profile", request.url);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("google_drive_error", "1");
    return NextResponse.redirect(target);
  }
}
