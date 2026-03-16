import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import type { Role, Permission } from "@isytask/shared";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado" });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

// ── Rate Limiter ──
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 200; // requests per window
const rateLimitMap = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const valid = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, valid);
  }
}, 5 * 60_000);

const rateLimit = t.middleware(({ ctx, next }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) return next();

  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const windowTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (windowTimestamps.length >= RATE_LIMIT_MAX) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
    });
  }

  windowTimestamps.push(now);
  rateLimitMap.set(userId, windowTimestamps);
  return next();
});

export const protectedProcedure = t.procedure.use(isAuthenticated).use(rateLimit);

function requireRole(...roles: Role[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado" });
    }
    const userRole = ctx.session.user.role as Role;
    // SUPER_ADMIN es god-mode: pasa CUALQUIER check de rol
    const passes = roles.includes(userRole) || userRole === "SUPER_ADMIN";
    if (!passes) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No tienes permisos para esta acción",
      });
    }
    return next({ ctx: { session: ctx.session } });
  });
}

/** Allows ADMIN role OR a COLABORADOR with one of the specified permissions */
export function requireAdminOrPermission(...permissions: Permission[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado" });
    }
    const { role } = ctx.session.user;
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      return next({ ctx: { session: ctx.session } });
    }
    if (role === "COLABORADOR") {
      const userPerms = (ctx.session.user.permissions ?? []) as string[];
      if (permissions.some((p) => userPerms.includes(p))) {
        return next({ ctx: { session: ctx.session } });
      }
    }
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No tienes permisos para esta acción",
    });
  });
}

/** Extract agencyId from authenticated session. Throws for SUPER_ADMIN without agency context. */
export function getAgencyId(ctx: { session: { user: { agencyId?: string; role?: string } } }): string {
  const { agencyId, role } = ctx.session.user;
  if (!agencyId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: role === "SUPER_ADMIN"
        ? "Esta operación requiere contexto de agencia."
        : "No se encontró agencyId en la sesión.",
    });
  }
  return agencyId;
}

export const superAdminProcedure = t.procedure.use(requireRole("SUPER_ADMIN" as Role));
export const adminProcedure = t.procedure.use(requireRole("ADMIN"));
export const colaboradorProcedure = t.procedure.use(
  requireRole("COLABORADOR")
);
export const clienteProcedure = t.procedure.use(requireRole("CLIENTE"));

// Platform staff procedures (SUPER_ADMIN hereda acceso automáticamente via god-mode)
export const soporteProcedure = t.procedure.use(requireRole("SOPORTE" as Role));
export const facturacionProcedure = t.procedure.use(requireRole("FACTURACION" as Role));
export const ventasProcedure = t.procedure.use(requireRole("VENTAS" as Role));
export const analistaProcedure = t.procedure.use(requireRole("ANALISTA" as Role));
export const platformProcedure = t.procedure.use(
  requireRole("SOPORTE" as Role, "FACTURACION" as Role, "VENTAS" as Role, "ANALISTA" as Role)
);

/** Create a procedure that allows ADMIN or COLABORADOR with specific permissions */
export function adminOrPermissionProcedure(...permissions: Permission[]) {
  return t.procedure.use(requireAdminOrPermission(...permissions));
}

// ── Product-aware middleware (ecosystem) ──

type ProductType = "ISYTASK" | "ISYSOCIAL";

/** Middleware that validates an agency has an active subscription for a specific product */
export function withProduct(product: ProductType) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No autenticado" });
    }
    const agencyId = ctx.session.user.agencyId as string | undefined;
    if (!agencyId) {
      // SUPER_ADMIN and platform staff don't need product checks
      const role = ctx.session.user.role as string;
      if (["SUPER_ADMIN", "SOPORTE", "FACTURACION", "VENTAS", "ANALISTA"].includes(role)) {
        return next({ ctx: { session: ctx.session, product } });
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "No se encontró agencyId" });
    }

    const subscription = await (ctx as any).db.subscription.findUnique({
      where: { agencyId_product: { agencyId, product } },
    });

    if (!subscription || !["active", "trial"].includes(subscription.status)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `No tienes acceso a ${product}. Actualiza tu suscripción.`,
      });
    }

    return next({
      ctx: { session: ctx.session, product, subscription },
    });
  });
}

export const isytaskProcedure = t.procedure.use(isAuthenticated).use(rateLimit).use(withProduct("ISYTASK"));
export const isysocialProcedure = t.procedure.use(isAuthenticated).use(rateLimit).use(withProduct("ISYSOCIAL"));
