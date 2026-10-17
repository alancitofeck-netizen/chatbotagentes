import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { connectGoogleSheetsExport } from "@/lib/integrations/googleSheetsExport";
import { googleSheetsExportReturnPath } from "../returnTarget";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawState = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  // state = "<workspaceId>:<referidos|agenda>" (ver connect/route.ts); sin sufijo = referidos.
  const [state, returnTo] = (rawState ?? "").split(":");

  const target = new URL(googleSheetsExportReturnPath(returnTo === "agenda" ? "agenda" : "referidos"), request.url);

  if (oauthError || !code || !state) {
    target.searchParams.set("sheet_export_error", "1");
    return NextResponse.redirect(target);
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active || active.workspaceId !== state) {
    target.searchParams.set("sheet_export_error", "1");
    return NextResponse.redirect(target);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-sheets-export/callback`;
    await connectGoogleSheetsExport(active.workspaceId, code, redirectUri);
    target.searchParams.set("sheet_export_connected", "1");
  } catch (err) {
    console.error("[google-sheets-export callback] connection failed:", err);
    target.searchParams.set("sheet_export_error", "1");
  }

  return NextResponse.redirect(target);
}
