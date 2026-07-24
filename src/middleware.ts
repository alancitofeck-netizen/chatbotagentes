import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];
// /reset-password used to require a Supabase session (established by the
// old magic-link recovery flow) — it's now a fully unauthenticated,
// OTP-code-driven flow (src/app/(auth)/reset-password/), authorized by its
// own httpOnly reset-token cookie instead, so it must NOT be gated here.
const PROTECTED_PREFIXES = ["/dashboard", "/select-workspace"];
const ACTIVE_WORKSPACE_COOKIE = "gl_active_workspace";

const FORBIDDEN_HTML = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><title>Acceso denegado — Growth Link</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center}
  .card{max-width:360px;padding:24px}
  h1{font-size:20px;margin:16px 0 8px}
  p{color:#a3a3a3;font-size:14px;margin:0 0 20px}
  a{color:#fff;background:#7c3aed;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500}
</style></head>
<body>
  <div class="card">
    <h1>Acceso denegado</h1>
    <p>No tenés permiso para ver esta sección.</p>
    <a href="/dashboard">Volver al Dashboard</a>
  </div>
</body>
</html>`;

function forbiddenResponse() {
  return new NextResponse(FORBIDDEN_HTML, {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** True when `pathname` needs the real-agent-role 403 gate (CRM "Agentes"
 * tab, its detail page, and ATS — all admin-facing per the role-permissions
 * spec). Doing this check in middleware (before any React rendering) is
 * required to get a genuine HTTP 403: calling forbidden() from inside the
 * page component itself always returns 200, because (protected)/loading.tsx
 * wraps every route in an implicit Suspense boundary, and Next.js commits
 * the response status to 200 the moment that boundary starts streaming —
 * before the page's own async role check can even run (see Next.js's
 * streaming docs: "the server commits to a 200 OK status" once a Suspense
 * fallback renders). The page-level forbidden() calls stay in place as
 * defense-in-depth (they still block the content from rendering), but only
 * this middleware check can actually flip the transport-level status code. */
function isRealAgentGatedPath(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname === "/ats" || pathname.startsWith("/ats/")) return true;
  if (pathname.startsWith("/crm/agents/")) return true;
  if (pathname === "/crm" && searchParams.get("tab") === "agents") return true;
  return false;
}

function isPlatformAdminOnlyPath(pathname: string): boolean {
  return pathname === "/admin/workspaces" || pathname.startsWith("/admin/workspaces/");
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname, searchParams } = request.nextUrl;

  const isGuestOnly = GUEST_ONLY_PATHS.some((path) => pathname === path);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestOnly && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && (isRealAgentGatedPath(pathname, searchParams) || isPlatformAdminOnlyPath(pathname))) {
    const { data: isPlatformAdmin } = await supabase.rpc("am_i_platform_admin");

    if (isPlatformAdminOnlyPath(pathname)) {
      if (!isPlatformAdmin) return forbiddenResponse();
    } else {
      const workspaceId = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value;
      if (workspaceId) {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", workspaceId)
          .eq("user_id", user.id)
          .maybeSingle();
        const role = membership?.role ?? null;
        // A real "agent" member is always blocked. No real membership row at
        // all is only legitimate for a platform admin in "modo supervisor"
        // (session.ts) — anyone else with no row has no business here.
        if (role === "agent" || (role === null && !isPlatformAdmin)) return forbiddenResponse();
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
