import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getGoogleSheetsAuthUrl } from "@/lib/integrations/googleSheets";

/** Starts the Google Sheets OAuth2 flow — mirrors
 * src/app/api/integrations/google-calendar/connect/route.ts exactly, just a
 * different provider/scope (spreadsheets.readonly instead of calendar). */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-sheets/callback`;
    const authUrl = getGoogleSheetsAuthUrl(redirectUri, active.workspaceId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[google-sheets connect] failed to build auth URL:", err);
    const target = new URL("/profile", request.url);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("google_sheets_error", "1");
    return NextResponse.redirect(target);
  }
}
