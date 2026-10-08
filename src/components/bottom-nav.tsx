"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/nav-items";
import { useClients, useCobros } from "@/lib/supabase/data";
import { cobrosVencidos } from "@/lib/domain/cobros";

export function BottomNav() {
  const pathname = usePathname();
  const clients = useClients();
  const cobros = useCobros();
  const vencidos = clients && cobros ? cobrosVencidos(cobros, clients, new Date()).length : 0;
  const activo = NAV_ITEMS.findIndex(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-3 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      aria-label="Navegación principal"
    >
      <div className="papel relative mx-auto flex max-w-[640px] items-stretch rounded-[22px] p-1.5 shadow-[var(--shadow-papel-alto)]">
        {/* The tab "puck" slides between items instead of jumping. */}
        {activo >= 0 && (
          <span
            aria-hidden
            className="absolute bottom-1.5 top-1.5 rounded-[16px] bg-terracota/[0.11] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              left: 6,
              width: `calc((100% - 12px) / ${NAV_ITEMS.length})`,
              transform: `translateX(${activo * 100}%)`,
            }}
          />
        )}
        {NAV_ITEMS.map(({ href, label, icon: Icon }, i) => {
          const active = i === activo;
          const showVencidos = href === "/plata" && vencidos > 0;
          return (
            <Link
              key={href}
              href={href}
              className="tocable relative flex flex-1 flex-col items-center gap-0.5 py-2"
              aria-current={active ? "page" : undefined}
            >
              <div className={cn("relative transition-transform duration-300", active && "-translate-y-px")}>
                <Icon
                  key={active ? "on" : "off"}
                  size={22}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={cn(active ? "pop text-terracota" : "text-texto-secundario")}
                />
                {showVencidos && (
                  <span
                    className="absolute -right-2.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-[8px] bg-terracota px-1 text-[0.6875rem] font-medium leading-none text-bg ring-2 ring-bg-elevada"
                    aria-label={`${vencidos} cobros vencidos`}
                  >
                    {vencidos}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[0.75rem] font-medium transition-colors",
                  active ? "text-terracota" : "text-texto-secundario",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
