"use client";

import { ViewTransition } from "react";
import { PlanProvider } from "@/lib/supabase/use-plan";
import { AccionesGlobales } from "./acciones-globales";
import { AvisoGlobal } from "./aviso-deshacer";
import { BottomNav } from "./bottom-nav";
import { CambioDeDia } from "./cambio-de-dia";
import { FallaDeCarga } from "./falla-de-carga";
import { Sidebar } from "./sidebar";

/** Wires up the desktop sidebar + mobile bottom nav around page content.
 * Route changes cross-dissolve the page column only; the chrome stays put.
 * The plan is computed here once for every screen, the bell and the badges. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <Sidebar />
      <main className="relative flex-1 pb-[calc(96px+env(safe-area-inset-bottom,0px))] lg:pb-10 lg:pl-[240px]">
        <AccionesGlobales />
        <CambioDeDia />
        <FallaDeCarga />
        <ViewTransition default="pagina">
          <div>{children}</div>
        </ViewTransition>
      </main>
      <BottomNav />
      <AvisoGlobal />
    </PlanProvider>
  );
}
