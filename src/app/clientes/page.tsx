"use client";

import Link from "next/link";
import { UserPlus, Calculator } from "lucide-react";
import { usePlan } from "@/lib/supabase/use-plan";
import { Client } from "@/lib/domain/types";
import { Entrega, entregaActual } from "@/lib/domain/entregas";
import { Cargando, EmptyState } from "@/components/empty-state";
import { Encabezado } from "@/components/encabezado";
import { TarjetaCliente } from "@/components/clientes/tarjeta-cliente";
import { indice } from "@/lib/utils";
import { colorCliente } from "@/lib/domain/calendario";
import { toISODate } from "@/lib/domain/dates";
import { cobrosDelPeriodo } from "@/lib/domain/cobros";

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
  const { clients, entregas, piezas, grabaciones } = ctx;
  const filas = ordenar(clients, entregas);
  const periodo = toISODate(ctx.today).slice(0, 7);
  const cobros = cobrosDelPeriodo(clients, ctx.cobros, periodo);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-2 lg:max-w-[960px] lg:px-8 lg:pt-4">
      <Encabezado
        titulo="Clientes"
        arriba="Qué le hacés a cada uno y cuándo"
        derecha={
          <Link
            href="/clientes/nuevo"
            aria-label="Agregar cliente"
            className="boton-primario tocable flex h-10 w-10 items-center justify-center rounded-full"
          >
            <UserPlus size={19} strokeWidth={2} />
          </Link>
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          title="Todavía no hay clientes"
          detail="Agregá el primero para que la app arme su ciclo de trabajo sola."
        />
      ) : (
        <section>
          <p className="entra mb-3 text-center text-[0.8125rem] text-texto-secundario" style={indice(1)}>
            Cada tarjeta muestra cómo va la entrega actual. Tocala para cambiar el ciclo, el volumen y las fechas: el plan
            se recalcula solo.
          </p>
          <ul className="grid items-start gap-3 lg:grid-cols-2">
            {filas.map(({ cliente: c, entrega: e }, i) => (
              <li key={c.id} className="papel desliza overflow-hidden" style={indice(i)}>
                <TarjetaCliente
                  cliente={c}
                  color={colorCliente(clients, c.id)}
                  entrega={e}
                  piezas={piezas}
                  grabaciones={grabaciones}
                  cobro={cobros.find((x) => x.clienteId === c.id)}
                  periodo={periodo}
                  today={ctx.today}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/clientes/simulador"
        className="entra tocable group mt-7 flex items-center justify-center gap-3 rounded-[14px] border border-dashed border-borde px-4 py-3 text-[0.9375rem] font-medium text-texto hover:border-acento-texto/40"
        style={indice(2)}
      >
        <Calculator size={18} className="text-texto-secundario transition-transform duration-300 group-hover:-rotate-6 group-hover:text-acento-texto" />
        Simular un prospecto antes de aceptarlo
      </Link>
    </div>
  );
}
