"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Briefcase,
  ListTodo,
  Settings,
  ClipboardList,
  PlusCircle,
  Bell,
  LogOut,
  ChevronLeft,
  Shield,
  User,
  RefreshCw,
  Activity,
  BarChart3,
  FileText,
  PieChart,
  Globe,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "./theme-switcher";
import { trpc } from "@/lib/trpc/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" />, permission: "dashboard" },
  { label: "Equipo", href: "/admin/equipo", icon: <Users className="h-5 w-5" />, permission: "manage_team" },
  { label: "Clientes", href: "/admin/clientes", icon: <UserCircle className="h-5 w-5" />, permission: "manage_clients" },
  { label: "Servicios", href: "/admin/servicios", icon: <Briefcase className="h-5 w-5" />, permission: "manage_services" },
  { label: "Tareas", href: "/admin/tareas", icon: <ListTodo className="h-5 w-5" />, permission: "manage_tasks" },
  { label: "Nueva Tarea", href: "/admin/nueva-tarea", icon: <PlusCircle className="h-5 w-5" />, permission: "manage_tasks" },
  { label: "Recurrentes", href: "/admin/tareas-recurrentes", icon: <RefreshCw className="h-5 w-5" />, permission: "manage_tasks" },
  { label: "Plantillas", href: "/admin/plantillas", icon: <FileText className="h-5 w-5" />, permission: "manage_services" },
  { label: "Rentabilidad", href: "/admin/reportes", icon: <BarChart3 className="h-5 w-5" />, permission: "dashboard" },
  { label: "Historial", href: "/admin/audit", icon: <Activity className="h-5 w-5" />, permission: "dashboard" },
  { label: "Configuración", href: "/admin/configuracion", icon: <Settings className="h-5 w-5" />, permission: "manage_config" },
];

const colaboradorNav: NavItem[] = [
  { label: "Mis Tareas", href: "/equipo", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Notificaciones", href: "/notificaciones", icon: <Bell className="h-5 w-5" /> },
];

const superAdminNav: NavItem[] = [
  { label: "Plataforma", href: "/superadmin", icon: <Globe className="h-5 w-5" /> },
  { label: "Agencias", href: "/superadmin/agencias", icon: <Building2 className="h-5 w-5" /> },
];

const clienteNav: NavItem[] = [
  { label: "Dashboard", href: "/cliente/dashboard", icon: <PieChart className="h-5 w-5" /> },
  { label: "Cola de Tareas", href: "/cliente", icon: <ListTodo className="h-5 w-5" /> },
  { label: "Nueva Tarea", href: "/cliente/nueva-tarea", icon: <PlusCircle className="h-5 w-5" /> },
  { label: "Mis Tareas", href: "/cliente/tareas", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Notificaciones", href: "/notificaciones", icon: <Bell className="h-5 w-5" /> },
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function useNavItems() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const permissions = ((session?.user as any)?.permissions ?? []) as string[];
  const avatarUrl = (session?.user as any)?.avatarUrl;
  const hasAdminAccess = role === "COLABORADOR" && permissions.length > 0;

  let navItems: NavItem[];
  if (role === "SUPER_ADMIN") {
    navItems = superAdminNav;
  } else if (role === "ADMIN") {
    navItems = adminNav;
  } else if (role === "COLABORADOR") {
    const items: NavItem[] = [...colaboradorNav];
    const permittedAdminItems = adminNav.filter(
      (item) => item.permission && permissions.includes(item.permission)
    );
    if (permittedAdminItems.length > 0) {
      items.push(...permittedAdminItems);
    }
    navItems = items;
  } else {
    navItems = clienteNav;
  }

  return { session, role, permissions, avatarUrl, hasAdminAccess, navItems };
}

// ─── Reusable sidebar content (used by both desktop & mobile) ───

interface SidebarContentProps {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void; // called when a nav link is clicked (mobile: close drawer)
}

export function SidebarContent({ collapsed, onCollapsedChange, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { session, role, avatarUrl, hasAdminAccess, navItems } = useNavItems();
  const isDark = theme === "dark";

  const { data: publicConfig } = trpc.config.getPublic.useQuery(undefined, {
    staleTime: 60000,
  });

  const companyLogoUrl = publicConfig?.company_logo_url;
  const companyLogoWhiteUrl = publicConfig?.company_logo_white_url;

  return (
    <>
      {/* Isytask Brand Logo */}
      {!collapsed ? (
        <div className="flex items-center justify-between p-4 border-b">
          <img
            src={isDark ? "/isytask-logo-white.svg" : "/isytask-logo.svg"}
            alt="Isytask"
            className="h-8 max-w-[140px] object-contain"
          />
          {onCollapsedChange && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCollapsedChange(true)}
              className="ml-auto flex-shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-3 px-1 border-b">
          <img
            src={isDark ? "/isytask-icon-white.svg" : "/isytask-icon.svg"}
            alt="Isytask"
            className="h-8 w-8 object-contain"
          />
          {onCollapsedChange && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCollapsedChange(false)}
              className="h-7 w-7"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          )}
        </div>
      )}

      {/* Company logo */}
      {!collapsed && companyLogoUrl && (
        <div className="px-4 py-3 border-b flex items-center justify-center">
          <img
            src={isDark ? (companyLogoWhiteUrl || companyLogoUrl) : companyLogoUrl}
            alt="Company"
            className="h-10 max-w-[160px] object-contain"
          />
        </div>
      )}

      {/* User info */}
      {!collapsed && session?.user && (
        <Link
          href="/perfil"
          className="block p-4 border-b hover:bg-accent/50 transition-colors"
          onClick={onNavigate}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={session.user.name || "Avatar"}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  {getInitials(session.user.name)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {role === "SUPER_ADMIN"
                    ? "Super Admin"
                    : role === "ADMIN"
                      ? "Administrador"
                      : role === "COLABORADOR"
                        ? "Equipo"
                        : "Cliente"}
                </span>
                {hasAdminAccess && (
                  <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    <Shield className="h-3 w-3" />
                    Permisos
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Collapsed avatar */}
      {collapsed && session?.user && (
        <Link href="/perfil" className="flex justify-center p-3 border-b" title="Mi Perfil" onClick={onNavigate}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {getInitials(session.user.name)}
            </div>
          )}
        </Link>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => {
          const isFirstAdminItem =
            role === "COLABORADOR" &&
            hasAdminAccess &&
            item.permission &&
            (index === 0 || !navItems[index - 1].permission);

          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/equipo" &&
              item.href !== "/cliente" &&
              pathname.startsWith(item.href)) ||
            (item.href === "/admin/tareas" && pathname === "/admin/nueva-tarea");

          return (
            <div key={item.href}>
              {isFirstAdminItem && (
                <div className="my-2 px-3">
                  {!collapsed && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Administración
                    </p>
                  )}
                  <div className="border-t mt-1" />
                </div>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "gradient-primary text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer: Theme + Logout */}
      <div className="p-2 border-t space-y-1">
        <ThemeSwitcher collapsed={collapsed} />
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </>
  );
}

// ─── Desktop Sidebar (hidden on mobile) ───

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-card h-screen sticky top-0 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
    </aside>
  );
}
