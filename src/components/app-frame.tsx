"use client";

import { ViewTransition } from "react";
import { AccionesGlobales } from "./acciones-globales";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

/** Wires up the desktop sidebar + mobile bottom nav around page content.
 * Route changes cross-dissolve the page column only; the chrome stays put. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="relative flex-1 pb-[calc(96px+env(safe-area-inset-bottom,0px))] lg:pb-10 lg:pl-[240px]">
        <AccionesGlobales />
        <ViewTransition default="pagina">
          <div>{children}</div>
        </ViewTransition>
      </main>
      <BottomNav />
    </>
  );
}
