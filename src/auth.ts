import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/db/client";
import { verifyLogin } from "@/lib/login";
import { clientIp } from "@/lib/http";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Host aus dem Request übernehmen (Vercel) – keine hart codierte AUTH_URL
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 3600, updateAge: 24 * 3600 },
  pages: { signIn: "/login", error: "/login" },
  logger: {
    // Fehlgeschlagene Logins sind erwartbar – nicht als Server-Fehler loggen
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error("[auth]", error.name, error.message);
    },
  },
  providers: [
    Credentials({
      credentials: { email: { label: "E-Mail" }, password: { label: "Passwort", type: "password" } },
      async authorize(credentials, request) {
        const user = await verifyLogin(getDb(), {
          email: credentials?.email,
          password: credentials?.password,
          ip: clientIp(request.headers),
        });
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Rolle und Kundenzuordnung werden bei jedem Request frisch aus der DB geladen (siehe lib/session.ts),
    // im JWT steht nur die User-ID (token.sub).
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});
