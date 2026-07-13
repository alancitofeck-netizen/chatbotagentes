import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { connectGoogleCalendar } from "@/lib/integrations/googleCalendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const target = new URL("/profile", request.url);
  target.searchParams.set("tab", "integrations");

  if (oauthError || !code || !state) {
    target.searchParams.set("google_calendar_error", "1");
    return NextResponse.redirect(target);
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  // `state` must match the caller's current active workspace — otherwise
  // this would let a signed-in user link a Google account to a workspace
  // that isn't the one that actually started the flow.
  if (!active || active.workspaceId !== state) {
    target.searchParams.set("google_calendar_error", "1");
    return NextResponse.redirect(target);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-calendar/callback`;
    await connectGoogleCalendar(active.workspaceId, code, redirectUri);
    target.searchParams.set("google_calendar_connected", "1");
  } catch (err) {
    console.error("[google-calendar callback] connection failed:", err);
    target.searchParams.set("google_calendar_error", "1");
  }

  return NextResponse.redirect(target);
}
