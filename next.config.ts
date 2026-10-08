import type { NextConfig } from "next";

// Grobe CSP: Next.js benötigt Inline-Skripte für Hydration (ohne Nonce-Setup).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Kein persistenter Turbopack-Cache im Build: Vercel stellt den Build-Cache des Vorgänger-Deployments wieder her,
    // dadurch wurde ein veraltetes globals.css ausgeliefert (Okt. 2026). Builds sind ohnehin schnell.
    turbopackFileSystemCacheForBuild: false,
    serverActions: {
      // Firmware-Upload per Server Action (Vercel-Request-Limit liegt bei 4,5 MB)
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
