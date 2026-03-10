"use client";

import { useSession } from "next-auth/react";
import { Topbar } from "@/components/layout/topbar";
import SuperAdminDashboard from "./components/super-admin-dashboard";
import SoporteDashboard from "./components/soporte-dashboard";
import FacturacionDashboard from "./components/facturacion-dashboard";
import VentasDashboard from "./components/ventas-dashboard";
import AnalistaDashboard from "./components/analista-dashboard";
import { ROLE_LABELS } from "@isytask/shared";

const DASHBOARD_TITLES: Record<string, string> = {
  SUPER_ADMIN: "Panel de Plataforma",
  SOPORTE: "Panel de Soporte",
  FACTURACION: "Panel de Facturacion",
  VENTAS: "Panel de Ventas",
  ANALISTA: "Panel de Analitica",
};

export default function PlatformDashboardPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as string;

  const title = DASHBOARD_TITLES[role] || "Panel de Plataforma";

  function renderDashboard() {
    switch (role) {
      case "SOPORTE":
        return <SoporteDashboard />;
      case "FACTURACION":
        return <FacturacionDashboard />;
      case "VENTAS":
        return <VentasDashboard />;
      case "ANALISTA":
        return <AnalistaDashboard />;
      default:
        return <SuperAdminDashboard />;
    }
  }

  return (
    <>
      <Topbar title={title} />
      <div className="p-4 md:p-6">
        {renderDashboard()}
      </div>
    </>
  );
}
