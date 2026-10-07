"use client";

import Link from "next/link";
import { Plus, ChevronRight, Calculator } from "lucide-react";
import { useClients } from "@/lib/supabase/data";
import { ClienteEstado } from "@/lib/domain/types";
import { ESTADO_CLIENTE_LABEL as ESTADO_LABEL } from "@/lib/domain/labels";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const SERVICIO_LABEL: Record<string, string> = {
  contenido: "Contenido",
  ads: "Ads",
  ambos: "Contenido + Ads",
};

/** Order of the groups: what needs attention first, parked clients last. */
const ORDEN: ClienteEstado[] = ["en-produccion", "esperando-aprobacion", "esperando-pago", "al-dia", "en-pausa"];

export default function ClientesPage() {
  const clients = useClients();
  const grupos = ORDEN.map((estado) => ({
    estado,
    clientes: (clients ?? []).filter((c) => c.estado === estado),
  })).filter((g) => g.clientes.length > 0);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[960px] lg:px-8 lg:pt-10">
      <header className="mb-5 flex items-center justify-between lg:mb-8">
        <h1 className="text-[1.25rem] font-semibold">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="flex items-center gap-1.5 rounded-[12px] bg-terracota px-4 py-2 text-[0.9375rem] font-medium text-bg"
        >
          <Plus size={18} strokeWidth={2.25} />
          Agregar
        </Link>
      </header>

      <Link
        href="/clientes/simulador"
        className="mb-5 flex items-center gap-2.5 rounded-[12px] border border-borde px-4 py-3 text-[0.9375rem] font-medium text-texto lg:mb-6 lg:inline-flex lg:w-auto"
      >
        <Calculator size={18} className="text-texto-secundario" />
        Simular un prospecto antes de aceptarlo
      </Link>

      {clients && clients.length === 0 ? (
        <EmptyState
          title="Todavía no hay clientes"
          detail="Agregá el primero para que la app arme su ciclo de trabajo sola."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(({ estado, clientes }) => (
            <section key={estado}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[0.8125rem] font-medium text-texto-secundario">
                {ESTADO_LABEL[estado]}
                <span>{clientes.length}</span>
              </h2>
              <ul
                className={cn(
                  "flex flex-col divide-y divide-borde border-y border-borde",
                  "lg:grid lg:grid-cols-2 lg:gap-3 lg:divide-y-0 lg:border-none xl:grid-cols-3",
                )}
              >
                {clientes.map((c) => (
                  <li key={c.id} className="lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada">
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-2 py-3.5 lg:px-4 lg:py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.nombre}</p>
                        <p className="text-[0.9375rem] text-texto-secundario">
                          {SERVICIO_LABEL[c.servicio]}
                          {c.intocable && " · intocable"}
                        </p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-texto-secundario" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
