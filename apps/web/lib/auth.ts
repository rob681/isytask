import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@isytask/db";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Credenciales requeridas");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: {
            clientProfile: { select: { id: true } },
            colaboradorProfile: { select: { id: true, permissions: true } },
          },
        });

        if (!user || !user.isActive) {
          throw new Error("Credenciales inválidas");
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Credenciales inválidas");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          clientProfileId: user.clientProfile?.id,
          colaboradorProfileId: user.colaboradorProfile?.id,
          permissions: (user.colaboradorProfile?.permissions as string[]) ?? [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.avatarUrl = (user as any).avatarUrl;
        token.clientProfileId = (user as any).clientProfileId;
        token.colaboradorProfileId = (user as any).colaboradorProfileId;
        token.permissions = (user as any).permissions ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).avatarUrl = token.avatarUrl;
        (session.user as any).clientProfileId = token.clientProfileId;
        (session.user as any).colaboradorProfileId = token.colaboradorProfileId;
        (session.user as any).permissions = token.permissions ?? [];
      }
      return session;
    },
  },
};
