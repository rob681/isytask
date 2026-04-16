import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@isytask/db";

const MAX_LOGIN_ATTEMPTS = 5;   // lock after this many consecutive failures
const LOCKOUT_MINUTES = 15;     // how long the account stays locked

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,      // 8 hours — security best practice
    updateAge: 60 * 60,        // Refresh JWT every hour on activity (sliding window)
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
          // loginAttempts, lockedUntil, mfaEnabled are included by default (no select = all scalars)
        });

        if (!user || !user.isActive) {
          throw new Error("Credenciales inválidas");
        }

        // Check email verification (required for self-service registrations)
        if (user.emailVerified === false) {
          throw new Error("Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada o solicita un nuevo enlace en /login.");
        }

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil(
            (user.lockedUntil.getTime() - Date.now()) / 60000
          );
          throw new Error(
            `Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en ${minutesLeft} minuto${minutesLeft !== 1 ? "s" : ""}.`
          );
        }

        // Si el usuario pertenece a una agencia, verificar que esté activa
        if (user.agencyId) {
          const agency = await db.agency.findUnique({
            where: { id: user.agencyId },
            select: { isActive: true },
          });
          if (agency && !agency.isActive) {
            throw new Error("Tu agencia ha sido desactivada. Contacta al administrador de la plataforma.");
          }
        }

        // User hasn't set a password yet (invitation pending)
        if (!user.passwordHash) {
          throw new Error("Debes configurar tu contraseña primero. Revisa tu correo de invitación.");
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          // Increment failed attempts; lock if threshold reached
          const newAttempts = (user.loginAttempts ?? 0) + 1;
          const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
          await db.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: newAttempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                : undefined,
            },
          });
          if (shouldLock) {
            throw new Error(
              `Cuenta bloqueada por ${MAX_LOGIN_ATTEMPTS} intentos fallidos. Intenta de nuevo en ${LOCKOUT_MINUTES} minutos.`
            );
          }
          throw new Error("Credenciales inválidas");
        }

        // Reset lockout on successful login
        if ((user.loginAttempts ?? 0) > 0 || user.lockedUntil) {
          await db.user.update({
            where: { id: user.id },
            data: { loginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          agencyId: user.agencyId ?? undefined,
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
        token.agencyId = (user as any).agencyId ?? null;
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
        (session.user as any).agencyId = token.agencyId ?? undefined;
        (session.user as any).clientProfileId = token.clientProfileId;
        (session.user as any).colaboradorProfileId = token.colaboradorProfileId;
        (session.user as any).permissions = token.permissions ?? [];
      }
      return session;
    },
  },
};
