"use client";

import { useState } from "react";
import { MobileNav, Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />

      {/* min-w-0 lets the main column shrink below its content width, so wide
          tables scroll inside their own container instead of stretching the
          page and forcing the whole body to scroll sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenuClick={() => setNavOpen(true)} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <h1 className="mb-4 font-display text-xl font-semibold tracking-tight sm:hidden">
            {title}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}
