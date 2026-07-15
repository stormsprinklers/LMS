import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyCrmLmsTicket } from "@/lib/crm-auth";

function mapCrmRoleToLms(role: string): "ADMIN" | "MANAGER" | "EMPLOYEE" {
  if (role === "ADMIN") return "ADMIN";
  if (role === "MANAGER") return "MANAGER";
  return "EMPLOYEE";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "crm-ticket",
      credentials: {
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials) {
        const ticket = credentials?.ticket ? String(credentials.ticket) : "";
        if (!ticket) return null;

        try {
          const claims = await verifyCrmLmsTicket(ticket);
          const user = await prisma.user.findFirst({
            where: {
              OR: [{ crmUserId: claims.crmUserId }, { email: claims.email }],
              archived: false,
            },
          });

          if (!user) {
            return null;
          }
          if (user.status !== "ACTIVE") {
            return null;
          }

          // Keep CRM link + profile aligned from the verified ticket.
          const nextRole =
            user.role === "COURSE_ADMIN"
              ? user.role
              : mapCrmRoleToLms(claims.role);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              crmUserId: claims.crmUserId,
              email: claims.email,
              name: claims.name ?? user.name,
              role: nextRole,
              passwordHash: null,
            },
          });

          return {
            id: user.id,
            email: claims.email,
            name: claims.name ?? user.name,
            role: nextRole,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
