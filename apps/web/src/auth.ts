import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  authenticateClientContact,
  authenticateStaffUser,
  createClientSession,
  createStaffSession,
  getDefaultTenant,
  validateClientSession,
  validateStaffSession,
} from "@hostpanel/core";
import { isAppError } from "@hostpanel/shared/errors";

type ActorType = "STAFF" | "CLIENT_CONTACT";

/**
 * Our domain layer throws AuthenticationError with a specific safe `.code`
 * (e.g. "auth.totp_required", "auth.locked"). CredentialsSignin is the one
 * error type next-auth re-throws as-is (rather than collapsing to a
 * generic failure) when signIn() is called from a Server Action, so we
 * carry the code through it — see lib/actions/auth.ts for the code -> UI
 * message mapping.
 */
export class DomainCredentialsError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

declare module "next-auth" {
  interface User {
    actorType: ActorType;
    sessionToken: string;
    mustChangePassword?: boolean;
  }
  interface Session {
    actorType?: ActorType;
    userId?: string;
    tenantId?: string;
    clientId?: string;
    permissions?: string[];
    impersonatedByStaffUserId?: string | null;
    mustChangePassword?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        actorType: { label: "Actor", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpToken: { label: "2FA code", type: "text" },
        ip: { label: "IP", type: "text" },
        userAgent: { label: "User agent", type: "text" },
      },
      async authorize(raw) {
        const actorType: ActorType = raw?.actorType === "STAFF" ? "STAFF" : "CLIENT_CONTACT";
        const email = String(raw?.email ?? "");
        const password = String(raw?.password ?? "");
        const ip = raw?.ip ? String(raw.ip) : undefined;
        const userAgent = raw?.userAgent ? String(raw.userAgent) : undefined;
        if (!email || !password) throw new DomainCredentialsError("auth.invalid_credentials");

        const tenant = await getDefaultTenant();

        try {
          if (actorType === "STAFF") {
            const staff = await authenticateStaffUser({
              tenantId: tenant.id,
              email,
              password,
              totpToken: raw?.totpToken ? String(raw.totpToken) : undefined,
              ip,
              userAgent,
            });
            const sessionToken = await createStaffSession({
              userId: staff.id,
              tenantId: tenant.id,
              ip,
              userAgent,
            });
            return {
              id: staff.id,
              email: staff.email,
              name: staff.name,
              actorType: "STAFF",
              sessionToken,
              mustChangePassword: staff.mustChangePassword,
            };
          }

          const contact = await authenticateClientContact({ tenantId: tenant.id, email, password, ip, userAgent });
          const sessionToken = await createClientSession({
            contactId: contact.id,
            tenantId: tenant.id,
            ip,
            userAgent,
          });
          return {
            id: contact.id,
            email: contact.email,
            name: contact.firstName,
            actorType: "CLIENT_CONTACT",
            sessionToken,
          };
        } catch (error) {
          if (isAppError(error)) {
            throw new DomainCredentialsError(error.code);
          }
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return { ...token, actorType: user.actorType, sessionToken: user.sessionToken };
      }
      return token;
    },
    // Re-validates against the DB-backed session row on every request (so
    // revocation and permission changes take effect immediately) rather
    // than trusting a cached JWT claim — see ARCHITECTURE.md "Sessions".
    async session({ session, token }) {
      const actorType = token.actorType as ActorType | undefined;
      const sessionToken = token.sessionToken as string | undefined;
      if (!actorType || !sessionToken) {
        return session;
      }

      if (actorType === "STAFF") {
        const actor = await validateStaffSession(sessionToken);
        if (!actor) return session;
        session.actorType = "STAFF";
        session.userId = actor.id;
        session.tenantId = actor.tenantId;
        session.permissions = [...actor.permissions];
        session.user.name = actor.label;
        return session;
      }

      const context = await validateClientSession(sessionToken);
      if (!context) return session;
      session.actorType = "CLIENT_CONTACT";
      session.userId = context.actor.id;
      session.clientId = context.actor.clientId;
      session.tenantId = context.actor.tenantId;
      session.impersonatedByStaffUserId = context.impersonatedByStaffUserId;
      session.user.name = context.actor.label;
      return session;
    },
  },
});
