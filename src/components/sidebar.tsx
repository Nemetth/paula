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
  const activo = NAV_ITEMS.findIndex(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-full w-[240px] flex-col border-r border-borde px-4 py-7 lg:flex"
      style={{ background: "var(--grano-fino) 0 0 / 200px 200px, var(--color-bg-elevada)" }}
    >
      <Link href="/hoy" className="mb-9 px-3">
        <span className="titulo-serif text-[1.75rem] font-medium italic leading-none">Paula</span>
        <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-terracota" aria-hidden />
      </Link>

      <nav className="relative flex flex-col gap-1">
        {activo >= 0 && (
          <span
            aria-hidden
            className="absolute left-0 right-0 top-0 h-[42px] rounded-[12px] bg-terracota/10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateY(${activo * 46}px)` }}
          />
        )}
        {NAV_ITEMS.map(({ href, label, icon: Icon }, i) => {
          const active = i === activo;
          const showVencidos = href === "/plata" && vencidos > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "tocable relative flex h-[42px] items-center gap-3 rounded-[12px] px-3 text-[0.9375rem] font-medium",
                active ? "text-terracota" : "text-texto-secundario hover:bg-borde/40 hover:text-texto",
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
          "tocable mt-auto flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[0.9375rem] font-medium",
          pathname === "/ajustes" ? "bg-terracota/10 text-terracota" : "text-texto-secundario hover:bg-borde/40 hover:text-texto",
        )}
        aria-current={pathname === "/ajustes" ? "page" : undefined}
      >
        <Settings size={19} strokeWidth={pathname === "/ajustes" ? 2.25 : 1.75} />
        Ajustes
      </Link>
    </aside>
  );
}
