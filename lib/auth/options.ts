import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { demoEnabled } from "@/lib/config";
import { database } from "@/lib/db/postgres";
import type { Database } from "@/lib/db/database";
import {
  createSession,
  sessionIdentity,
  revokeSession,
  SESSION_SECONDS,
} from "./registry";
import { demoAttemptAllowed } from "./throttle";
export function authOptions(
  getDatabase: () => Database = database,
): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: { prompt: "select_account", scope: "openid email profile" },
        },
      }),
    );
  if (demoEnabled())
    providers.push(
      CredentialsProvider({
        id: "local-demo",
        name: "Local demonstration",
        credentials: { role: { type: "text" }, password: { type: "password" } },
        async authorize(credentials) {
          if (!demoEnabled() || !credentials?.password) return null;
          if (!(await demoAttemptAllowed(getDatabase()))) return null;
          if (credentials.password.length > 1024) return null;
          const expected = Buffer.from(process.env.LOCAL_DEMO_PASSWORD ?? "");
          const actual = Buffer.from(credentials.password);
          if (
            actual.length !== expected.length ||
            !timingSafeEqual(actual, expected)
          )
            return null;
          // These identities exist only in loopback development. No user-controlled email or role claims.
          const role = credentials.role;
          if (!["admin", "student", "outsider"].includes(role ?? ""))
            return null;
          const email =
            role === "admin"
              ? "demo-admin@example.com"
              : role === "student"
                ? "student1@example.com"
                : "outsider@example.com";
          return {
            id: "demo:" + role,
            email,
            name:
              role === "admin"
                ? "Demo Administrator"
                : role === "student"
                  ? "Aarav Sharma"
                  : "Unregistered Student",
          };
        },
      }),
    );
  return {
    providers,
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: SESSION_SECONDS },
    pages: { signIn: "/" },
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider === "local-demo") return demoEnabled();
        return (
          account?.provider === "google" &&
          (profile as { email_verified?: boolean })?.email_verified === true
        );
      },
      async jwt({ token, user }) {
        if (user) {
          token.email = user.email?.toLowerCase();
          token.name = user.name;
          if (!token.email) throw new Error("Missing authenticated identity");
          token.sessionId = await createSession(getDatabase(), token.email);
        }
        return token;
      },
      async session({ session, token }) {
        const identity = await sessionIdentity(
          getDatabase(),
          token.sessionId,
          token.email,
        );
        if (!identity) return { expires: new Date(0).toISOString() };
        session.expires = new Date(identity.expires_at).toISOString();
        session.user = {
          email: identity.email,
          name: String(token.name ?? "Student"),
        };
        return session;
      },
    },
    events: {
      async signOut(message) {
        if ("token" in message)
          await revokeSession(getDatabase(), message.token?.sessionId);
      },
    },
    logger: {
      error(code) {
        console.error(JSON.stringify({ event: "authentication_error", code }));
      },
      warn(code) {
        console.warn(JSON.stringify({ event: "authentication_warning", code }));
      },
      debug() {},
    },
  };
}
