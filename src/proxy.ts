import { NextResponse, type NextRequest } from "next/server";

/**
 * Nur optimistischer Redirect auf /login, wenn gar kein Session-Cookie vorhanden ist.
 * Die eigentliche Autorisierung passiert serverseitig in jeder Seite/Server Action (requireUser/requireAdmin).
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((n) => req.cookies.has(n) || req.cookies.has(`${n}.0`));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // API-Routen (ingest, gateway, firmware, cron, auth) bewusst ausgeschlossen
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
