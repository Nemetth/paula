"use client";

import Link from "next/link";
import { Plus, ChevronRight, Calculator } from "lucide-react";
import { usePlan } from "@/lib/supabase/use-plan";
import { Client } from "@/lib/domain/types";
import { Entrega, entregaActual } from "@/lib/domain/entregas";
import { ESTADO_CLIENTE_LABEL } from "@/lib/domain/labels";
import { Cargando, EmptyState } from "@/components/empty-state";
import { SEMAFORO_ENTREGA, SemaforoPunto, fechaDM } from "@/components/entrega";
import { cn, indice } from "@/lib/utils";
import { colorCliente } from "@/lib/domain/calendario";

const SERVICIO_LABEL: Record<string, string> = {
  contenido: "Contenido",
  ads: "Ads",
  ambos: "Contenido + Ads",
};

/** Nearest delivery first; clients with nothing due after, paused ones last. */
function ordenar(clients: Client[], entregas: Entrega[]) {
  const filas = clients.map((c) => ({ cliente: c, entrega: entregaActual(entregas, c.id) }));
  const pausado = (c: Client) => !c.activo || c.estado === "en-pausa";
  return filas.sort(
    (a, b) =>
      Number(pausado(a.cliente)) - Number(pausado(b.cliente)) ||
      (a.entrega?.fecha ?? "9999").localeCompare(b.entrega?.fecha ?? "9999") ||
      a.cliente.nombre.localeCompare(b.cliente.nombre),
  );
}

export default function ClientesPage() {
  const ctx = usePlan();
  if (!ctx) return <Cargando />;
  const { clients, entregas } = ctx;
  const filas = ordenar(clients, entregas);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[960px] lg:px-8 lg:pt-4">
      <header className="entra mb-6 flex items-center justify-between lg:mb-8">
        <h1 className="titulo-serif text-[1.875rem] font-medium leading-[1.15] lg:text-[2.25rem]">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="boton-primario tocable flex items-center gap-1.5 rounded-[12px] px-4 py-2 text-[0.9375rem] font-medium"
        >
          <Plus size={18} strokeWidth={2.25} />
          Agregar
        </Link>
      </header>

      <Link
        href="/clientes/simulador"
        className="entra tocable group mb-7 flex items-center gap-3 rounded-[14px] border border-dashed border-borde px-4 py-3 text-[0.9375rem] font-medium text-texto hover:border-terracota/40 lg:inline-flex lg:w-auto"
        style={indice(1)}
      >
        <Calculator size={18} className="text-texto-secundario transition-transform duration-300 group-hover:-rotate-6 group-hover:text-terracota" />
        Simular un prospecto antes de aceptarlo
      </Link>

      {clients.length === 0 ? (
        <EmptyState
          title="Todavía no hay clientes"
          detail="Agregá el primero para que la app arme su ciclo de trabajo sola."
        />
      ) : (
        <section className="entra" style={indice(2)}>
          <h2 className="mb-2 text-[0.8125rem] font-medium text-texto-secundario">Por entrega más cercana</h2>
          <ul
            className={cn(
              "papel flex flex-col divide-y divide-borde/80 px-1.5",
              "lg:grid lg:grid-cols-2 lg:gap-3 lg:divide-y-0 lg:border-none lg:bg-none lg:bg-transparent lg:p-0 lg:shadow-none xl:grid-cols-3",
            )}
          >
            {filas.map(({ cliente: c, entrega: e }) => (
              <li key={c.id} className="lg:rounded-[16px] lg:border lg:border-borde lg:bg-bg-elevada lg:shadow-papel lg:transition-[transform,box-shadow] lg:duration-300 lg:hover:-translate-y-0.5 lg:hover:shadow-papel-alto">
                <Link href={`/clientes/${c.id}`} className="tocable group flex items-center gap-3 px-2.5 py-3.5 lg:px-4 lg:py-4">
                  <Inicial nombre={c.nombre} color={colorCliente(clients, c.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-semibold">{c.nombre}</span>
                      {e && <SemaforoPunto semaforo={e.semaforo} />}
                    </p>
                    <p className="text-[0.9375rem] text-texto-secundario">
                      {e ? (
                        <>
                          <span className="numeros">
                            Entrega {fechaDM(e.fecha)} · faltan {e.faltan} de {e.total}
                          </span>
                          <span className={cn("font-medium", SEMAFORO_ENTREGA[e.semaforo].texto)}>
                            {" "}
                            · {SEMAFORO_ENTREGA[e.semaforo].label.toLowerCase()}
                          </span>
                        </>
                      ) : (
                        <>
                          {c.estado === "en-pausa" || !c.activo ? ESTADO_CLIENTE_LABEL["en-pausa"] : "Sin entregas pendientes"}
                          {" · "}
                          {SERVICIO_LABEL[c.servicio]}
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-texto-secundario transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Client monogram in the client's calendar color, so the same hue ties the
 * roster, Hoy's day strip and the calendar dots together. */
function Inicial({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      aria-hidden
      className="titulo-serif flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[1.125rem] font-medium transition-transform duration-300 group-hover:scale-105"
      style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
    >
      {(nombre.replace(/^\s*\[[^\]]*\]\s*/, "").match(/\p{L}|\d/u)?.[0] ?? "·").toUpperCase()}
    </span>
  );
}
