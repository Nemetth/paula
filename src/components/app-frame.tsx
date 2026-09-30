"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

/** Wires up the desktop sidebar + mobile bottom nav around page content, and
 * strips both plus the reserved layout space on /login, which has its own
 * centered, chrome-free page. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <>
      {!isLogin && <Sidebar />}
      <main
        className={cn(
          "flex-1",
          !isLogin && "pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-[240px]",
        )}
      >
        {children}
      </main>
      {!isLogin && <BottomNav />}
    </>
  );
}
