"use client";

import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

/** Wires up the desktop sidebar + mobile bottom nav around page content. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-[240px]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
