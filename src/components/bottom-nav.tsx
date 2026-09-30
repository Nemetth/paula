"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, useCobros } from "@/lib/supabase/data";
import { cobrosVencidos } from "@/lib/domain/cobros";

const ITEMS = [
  { href: "/hoy", label: "Hoy", icon: Sun },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/plata", label: "Plata", icon: Wallet },
];

export function BottomNav() {
  const pathname = usePathname();
  const clients = useClients();
  const cobros = useCobros();
  const vencidos = clients && cobros ? cobrosVencidos(cobros, clients, new Date()).length : 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-borde bg-bg-elevada rounded-t-[20px] shadow-[var(--shadow-nav)] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-[640px] items-stretch justify-around px-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showVencidos = href === "/plata" && vencidos > 0;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={cn(active ? "text-terracota" : "text-texto-secundario")}
                />
                {showVencidos && (
                  <span
                    className="absolute -right-2.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-[8px] bg-terracota px-1 text-[0.6875rem] font-medium leading-none text-bg"
                    aria-label={`${vencidos} cobros vencidos`}
                  >
                    {vencidos}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[0.8125rem] font-medium",
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
