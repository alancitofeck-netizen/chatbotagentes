import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getGoogleAuthUrl } from "@/lib/integrations/googleCalendar";

/** Starts the Google Calendar OAuth2 flow — redirects to Google's consent
 * screen. `state` carries the workspace id so the callback can confirm it's
 * still the same workspace that initiated the flow. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.redirect(new URL("/select-workspace", request.url));

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/google-calendar/callback`;
    const authUrl = getGoogleAuthUrl(redirectUri, active.workspaceId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[google-calendar connect] failed to build auth URL:", err);
    const target = new URL("/profile", request.url);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("google_calendar_error", "1");
    return NextResponse.redirect(target);
  }
}
