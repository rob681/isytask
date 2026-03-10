import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Map admin routes to required permissions
const ADMIN_ROUTE_PERMISSIONS: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/equipo": "manage_team",
  "/admin/clientes": "manage_clients",
  "/admin/servicios": "manage_services",
  "/admin/tareas": "manage_tasks",
  "/admin/nueva-tarea": "manage_tasks",
  "/admin/configuracion": "manage_config",
};

function colaboradorCanAccessAdminRoute(path: string, permissions: string[]): boolean {
  if (permissions.length === 0) return false;

  // Sort routes by length descending so most specific routes match first
  const sortedRoutes = Object.entries(ADMIN_ROUTE_PERMISSIONS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [route, permission] of sortedRoutes) {
    if (path === route || path.startsWith(route + "/")) {
      return permissions.includes(permission);
    }
  }
  return false;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = token.role as string;
    const permissions = (token.permissions as string[]) ?? [];

    // /perfil and /notificaciones are accessible to all authenticated users
    if (path === "/perfil" || path.startsWith("/notificaciones")) {
      return NextResponse.next();
    }

    // Super-admin routes
    if (path.startsWith("/superadmin") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Route protection by role
    if (path.startsWith("/admin")) {
      if (role === "SUPER_ADMIN" || role === "ADMIN") {
        // Full access
      } else if (role === "COLABORADOR" && colaboradorCanAccessAdminRoute(path, permissions)) {
        // Collaborator with permissions can access specific admin routes
      } else {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
    if (path.startsWith("/equipo") && role !== "COLABORADOR") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (path.startsWith("/cliente") && role !== "CLIENTE") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Redirect root to role-specific dashboard
    if (path === "/") {
      switch (role) {
        case "SUPER_ADMIN":
          return NextResponse.redirect(new URL("/superadmin", req.url));
        case "ADMIN":
          return NextResponse.redirect(new URL("/admin", req.url));
        case "COLABORADOR":
          return NextResponse.redirect(new URL("/equipo", req.url));
        case "CLIENTE":
          return NextResponse.redirect(new URL("/cliente", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/superadmin/:path*",
    "/admin/:path*",
    "/equipo/:path*",
    "/cliente/:path*",
    "/perfil",
    "/notificaciones",
  ],
};
