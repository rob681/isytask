import { Sidebar } from "@/components/layout/sidebar";
import { NotificationListener } from "@/components/layout/notification-listener";
import { GuidedTour } from "@/components/tour/guided-tour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <NotificationListener />
      <GuidedTour />
    </div>
  );
}
