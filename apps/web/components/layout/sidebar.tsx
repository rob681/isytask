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
  HeadphonesIcon,
  CreditCard,
  TrendingUp,
  Receipt,
  ExternalLink,
  Share2,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "./theme-switcher";
import { ProductSelector } from "./product-selector";
import { trpc } from "@/lib/trpc/client";
import { ChevronDown } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  permission?: string;
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const adminNav: NavEntry[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" />, permission: "dashboard" },
  { label: "Equipo", href: "/admin/equipo", icon: <Users className="h-5 w-5" />, permission: "manage_team" },
  { label: "Clientes", href: "/admin/clientes", icon: <UserCircle className="h-5 w-5" />, permission: "manage_clients" },
  { label: "Servicios", href: "/admin/servicios", icon: <Briefcase className="h-5 w-5" />, permission: "manage_services" },
  {
    label: "Tareas",
    icon: <ListTodo className="h-5 w-5" />,
    permission: "manage_tasks",
    items: [
      { label: "Tareas", href: "/admin/tareas", icon: <ListTodo className="h-4 w-4" />, permission: "manage_tasks" },
      { label: "Nueva Tarea", href: "/admin/nueva-tarea", icon: <PlusCircle className="h-4 w-4" />, permission: "manage_tasks" },
      { label: "Recurrentes", href: "/admin/tareas-recurrentes", icon: <RefreshCw className="h-4 w-4" />, permission: "manage_tasks" },
      { label: "Plantillas", href: "/admin/plantillas", icon: <FileText className="h-4 w-4" />, permission: "manage_services" },
    ],
  },
  {
    label: "Analíticas",
    icon: <BarChart3 className="h-5 w-5" />,
    permission: "dashboard",
    items: [
      { label: "Rentabilidad", href: "/admin/reportes", icon: <BarChart3 className="h-4 w-4" />, permission: "dashboard" },
      { label: "Historial", href: "/admin/audit", icon: <Activity className="h-4 w-4" />, permission: "dashboard" },
    ],
  },
  {
    label: "Configuración",
    icon: <Settings className="h-5 w-5" />,
    permission: "manage_config",
    items: [
      { label: "General", href: "/admin/configuracion", icon: <Settings className="h-4 w-4" />, permission: "manage_config" },
      { label: "Facturación", href: "/admin/billing", icon: <CreditCard className="h-4 w-4" />, permission: "manage_config" },
      { label: "WhatsApp", href: "/admin/whatsapp", icon: <MessageSquare className="h-4 w-4" />, permission: "manage_config" },
    ],
  },
];

// Flat version for roles that don't use groups (colaborador permission filtering)
const adminNavFlat: NavItem[] = [
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
  { label: "WhatsApp", href: "/admin/whatsapp", icon: <MessageSquare className="h-5 w-5" />, permission: "manage_config" },
  { label: "Facturación", href: "/admin/billing", icon: <CreditCard className="h-5 w-5" />, permission: "manage_config" },
  { label: "Configuración", href: "/admin/configuracion", icon: <Settings className="h-5 w-5" />, permission: "manage_config" },
];

const colaboradorNav: NavItem[] = [
  { label: "Mis Tareas", href: "/equipo", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Notificaciones", href: "/notificaciones", icon: <Bell className="h-5 w-5" /> },
];

const superAdminNav: NavItem[] = [
  { label: "Plataforma", href: "/superadmin", icon: <Globe className="h-5 w-5" /> },
  { label: "Agencias", href: "/superadmin/agencias", icon: <Building2 className="h-5 w-5" /> },
  { label: "Staff", href: "/superadmin/staff", icon: <Shield className="h-5 w-5" /> },
  { label: "Soporte", href: "/superadmin/soporte/agencias", icon: <HeadphonesIcon className="h-5 w-5" /> },
  { label: "Facturacion", href: "/superadmin/facturacion/agencias", icon: <CreditCard className="h-5 w-5" /> },
  { label: "Ventas", href: "/superadmin/ventas/agencias", icon: <TrendingUp className="h-5 w-5" /> },
  { label: "Analitica", href: "/superadmin/analista/tendencias", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Configuracion", href: "/superadmin/configuracion", icon: <Settings className="h-5 w-5" /> },
];

const soporteNav: NavItem[] = [
  { label: "Dashboard", href: "/superadmin", icon: <HeadphonesIcon className="h-5 w-5" /> },
  { label: "Agencias", href: "/superadmin/soporte/agencias", icon: <Building2 className="h-5 w-5" /> },
  { label: "Usuarios", href: "/superadmin/soporte/usuarios", icon: <Users className="h-5 w-5" /> },
];

const facturacionNav: NavItem[] = [
  { label: "Dashboard", href: "/superadmin", icon: <CreditCard className="h-5 w-5" /> },
  { label: "Agencias", href: "/superadmin/facturacion/agencias", icon: <Building2 className="h-5 w-5" /> },
  { label: "Suscripciones", href: "/superadmin/facturacion/suscripciones", icon: <Receipt className="h-5 w-5" /> },
];

const ventasNav: NavItem[] = [
  { label: "Dashboard", href: "/superadmin", icon: <TrendingUp className="h-5 w-5" /> },
  { label: "Agencias", href: "/superadmin/ventas/agencias", icon: <Building2 className="h-5 w-5" /> },
];

const analistaNav: NavItem[] = [
  { label: "Dashboard", href: "/superadmin", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Tendencias", href: "/superadmin/analista/tendencias", icon: <Activity className="h-5 w-5" /> },
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

  let navEntries: NavEntry[];
  let flatItems: NavItem[] | null = null; // For colaborador permission filtering

  if (role === "SUPER_ADMIN") {
    navEntries = superAdminNav;
  } else if (role === "SOPORTE") {
    navEntries = soporteNav;
  } else if (role === "FACTURACION") {
    navEntries = facturacionNav;
  } else if (role === "VENTAS") {
    navEntries = ventasNav;
  } else if (role === "ANALISTA") {
    navEntries = analistaNav;
  } else if (role === "ADMIN") {
    navEntries = adminNav;
  } else if (role === "COLABORADOR") {
    const items: NavItem[] = [...colaboradorNav];
    const permittedAdminItems = adminNavFlat.filter(
      (item) => item.permission && permissions.includes(item.permission)
    );
    if (permittedAdminItems.length > 0) {
      items.push(...permittedAdminItems);
    }
    navEntries = items;
    flatItems = items;
  } else {
    navEntries = clienteNav;
  }

  return { session, role, permissions, avatarUrl, hasAdminAccess, navEntries, flatItems };
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
  const { session, role, avatarUrl, hasAdminAccess, navEntries } = useNavItems();
  const isDark = theme === "dark";

  // Collapsible group state — auto-expand group with active item
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebar-open-groups");
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set<string>();
  });

  // Auto-expand group containing active route
  useEffect(() => {
    for (const entry of navEntries) {
      if (isNavGroup(entry)) {
        const hasActive = entry.items.some(
          (item) =>
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href)) ||
            (item.href === "/admin/tareas" && pathname === "/admin/nueva-tarea")
        );
        if (hasActive && !openGroups.has(entry.label)) {
          setOpenGroups((prev) => {
            const next = new Set(prev);
            next.add(entry.label);
            return next;
          });
        }
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try { localStorage.setItem("sidebar-open-groups", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  function isItemActive(href: string) {
    return (
      pathname === href ||
      (href !== "/admin" &&
        href !== "/equipo" &&
        href !== "/cliente" &&
        pathname.startsWith(href)) ||
      (href === "/admin/tareas" && pathname === "/admin/nueva-tarea")
    );
  }

  function isGroupActive(group: NavGroup) {
    return group.items.some((item) => isItemActive(item.href));
  }

  const { data: publicConfig } = trpc.config.getPublic.useQuery(undefined, {
    staleTime: 60000,
  });

  const { data: agencyLogo } = trpc.agencies.getMyAgencyLogo.useQuery(undefined, {
    staleTime: 60000,
  });

  const companyLogoUrl = agencyLogo?.logoUrl;
  const companyLogoWhiteUrl = agencyLogo?.logoWhiteUrl;

  return (
    <>
      {/* Isytask Brand Logo */}
      {!collapsed ? (
        <div className="flex items-center justify-between p-4 border-b">
          <img
            src="/isytask-logo.svg"
            alt="Isytask"
            className="h-8 max-w-[140px] object-contain dark:hidden"
          />
          <img
            src="/isytask-logo-white.svg"
            alt="Isytask"
            className="h-8 max-w-[140px] object-contain hidden dark:block"
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
            src="/isytask-icon.svg"
            alt="Isytask"
            className="h-8 w-8 object-contain dark:hidden"
          />
          <img
            src="/isytask-icon-white.svg"
            alt="Isytask"
            className="h-8 w-8 object-contain hidden dark:block"
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

      {/* Product Selector (multi-product ecosystem) */}
      {(role === "ADMIN" || role === "COLABORADOR" || role === "CLIENTE") && (
        <div className="px-2 py-1 border-b">
          <ProductSelector collapsed={collapsed} />
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
                  {role === "SUPER_ADMIN" ? "Super Admin"
                    : role === "SOPORTE" ? "Soporte"
                    : role === "FACTURACION" ? "Facturacion"
                    : role === "VENTAS" ? "Ventas"
                    : role === "ANALISTA" ? "Analista"
                    : role === "ADMIN" ? "Administrador"
                    : role === "COLABORADOR" ? "Equipo"
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
        {navEntries.map((entry, index) => {
          if (isNavGroup(entry)) {
            const groupOpen = openGroups.has(entry.label);
            const groupActive = isGroupActive(entry);

            if (collapsed) {
              // In collapsed mode, show group icon with active indicator
              return (
                <div key={entry.label} title={entry.label}>
                  <button
                    onClick={() => toggleGroup(entry.label)}
                    className={cn(
                      "flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium transition-all duration-200 w-full",
                      groupActive
                        ? "gradient-primary text-white shadow-md"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {entry.icon}
                  </button>
                </div>
              );
            }

            return (
              <div key={entry.label}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 w-full",
                    groupActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {entry.icon}
                  <span className="flex-1 text-left">{entry.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      groupOpen ? "rotate-180" : ""
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    groupOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5 py-1">
                    {entry.items.map((item) => {
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-200",
                            active
                              ? "gradient-primary text-white shadow-sm"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Regular nav item (not a group)
          const item = entry as NavItem;
          const isFirstAdminItem =
            role === "COLABORADOR" &&
            hasAdminAccess &&
            item.permission &&
            (index === 0 || !(navEntries[index - 1] as NavItem).permission);

          const isActive = isItemActive(item.href);

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

      {/* Isysocial cross-app link */}
      {(role === "ADMIN" || role === "COLABORADOR") && (
        <div className="px-2 pb-1">
          <a
            href="https://isysocial-web.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? "Abrir Isysocial" : undefined}
          >
            <Share2 className="h-5 w-5" />
            {!collapsed && (
              <span className="flex items-center gap-1.5">
                Isysocial <ExternalLink className="h-3 w-3 opacity-50" />
              </span>
            )}
          </a>
        </div>
      )}

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
