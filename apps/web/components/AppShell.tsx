"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { RightPanel } from "@/components/RightPanel";
import { MarketContextProvider } from "@/lib/marketContext";

/** Jupiter-style 3-column desktop shell (sidebar / content / position
 * panel), collapsing to a single column with a hamburger-toggled sidebar
 * drawer on mobile. Wraps every page via app/layout.tsx. */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <MarketContextProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMenu={() => setMobileNavOpen(true)} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <RightPanel />
      </div>
    </MarketContextProvider>
  );
}
