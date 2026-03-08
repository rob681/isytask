import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { NotificationListener } from "@/components/layout/notification-listener";
import { GuidedTour } from "@/components/tour/guided-tour";
import { ErrorBoundary } from "@/components/error-boundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto min-w-0">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <NotificationListener />
        <GuidedTour />
      </div>
    </SidebarProvider>
  );
}
