import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getGoogleSheetsExportAuthUrl } from "@/lib/integrations/googleSheetsExport";

/** Starts the Google Sheets (write) OAuth2 flow — mirrors
 * src/app/api/integrations/google-sheets/connect/route.ts exactly, just a
 * different provider/scope (spreadsheets, not spreadsheets.readonly) and it
 * redirects back to Asesorías > Referidos instead of /profile, since that's
 * where "Exportar referidos a hoja" lives. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-sheets-export/callback`;
    const authUrl = getGoogleSheetsExportAuthUrl(redirectUri, active.workspaceId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[google-sheets-export connect] failed to build auth URL:", err);
    const target = new URL("/asesorias/referidos", request.url);
    target.searchParams.set("sheet_export_error", "1");
    return NextResponse.redirect(target);
  }
}
