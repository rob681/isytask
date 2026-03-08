"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { Sheet } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar";

interface SidebarContextValue {
  openMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  openMobile: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider value={{ openMobile }}>
      {children}

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left">
        <div className="flex flex-col h-full">
          <SidebarContent collapsed={false} onNavigate={closeMobile} />
        </div>
      </Sheet>
    </SidebarContext.Provider>
  );
}
