"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/nav-items";
import { useClients, useCobros } from "@/lib/supabase/data";
import { cobrosVencidos } from "@/lib/domain/cobros";


/** Desktop-only left nav — the "generic SaaS" counterpart to the mobile
 * bottom tab bar. Mobile keeps the bottom bar (see BottomNav); this never
 * renders below the lg breakpoint. */
export function Sidebar() {
  const pathname = usePathname();
  const clients = useClients();
  const cobros = useCobros();
  const vencidos = clients && cobros ? cobrosVencidos(cobros, clients, new Date()).length : 0;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-[240px] flex-col border-r border-borde bg-bg-elevada px-4 py-6 lg:flex">
      <p className="mb-8 px-3 text-[1.25rem] font-semibold">Paula</p>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showVencidos = href === "/plata" && vencidos > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[0.9375rem] font-medium",
                active ? "bg-terracota/10 text-terracota" : "text-texto-secundario hover:bg-borde/40",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.25 : 1.75} />
              {label}
              {showVencidos && (
                <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-[8px] bg-terracota px-1 text-[0.6875rem] font-medium leading-none text-bg">
                  {vencidos}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/ajustes"
        className={cn(
          "mt-auto flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[0.9375rem] font-medium",
          pathname === "/ajustes" ? "bg-terracota/10 text-terracota" : "text-texto-secundario hover:bg-borde/40",
        )}
        aria-current={pathname === "/ajustes" ? "page" : undefined}
      >
        <Settings size={19} strokeWidth={pathname === "/ajustes" ? 2.25 : 1.75} />
        Ajustes
      </Link>
    </aside>
  );
}
