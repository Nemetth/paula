"use client";

import { useEffect, useMemo } from "react";
import { endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import { crearOActualizarCobro, useClients, useCobros } from "@/lib/supabase/data";
import { CobroEstado } from "@/lib/domain/types";
import { estadoCobro } from "@/lib/domain/cobros";
import { toISODate } from "@/lib/domain/dates";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const ESTADO_LABEL: Record<CobroEstado, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  vencido: "Vencido",
};

function periodoActual() {
  return toISODate(new Date()).slice(0, 7);
}

export default function PlataPage() {
  const clients = useClients();
  const periodo = periodoActual();
  const cobrosTodos = useCobros();
  const cobros = useMemo(() => cobrosTodos?.filter((c) => c.periodo === periodo), [cobrosTodos, periodo]);

  // Make sure every active client has a cobro row for the current period.
  useEffect(() => {
    if (!clients || !cobros) return;
    const existentes = new Set(cobros.map((c) => c.clienteId));
    const hoy = new Date();
    clients
      .filter((c) => c.activo && !existentes.has(c.id))
      .forEach((c) => {
        const diaVencimiento = c.ventanaCobro?.[1] ?? endOfMonth(hoy).getDate();
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(diaVencimiento, endOfMonth(hoy).getDate()));
        crearOActualizarCobro(c.id, periodo, {
          monto: c.montoMensual,
          fechaVencimiento: toISODate(fecha),
        });
      });
  }, [clients, cobros, periodo]);

  const filas = useMemo(() => {
    if (!clients || !cobros) return [];
    const hoy = new Date();
    return cobros
      .map((cobro) => {
        const cliente = clients.find((c) => c.id === cobro.clienteId);
        const estado: CobroEstado = estadoCobro(cobro, hoy);
        return { cobro, cliente, estado };
      })
      .filter((f) => f.cliente)
      .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "vencido" ? -1 : 1));
  }, [clients, cobros]);

  const totalPendiente = filas
    .filter((f) => f.estado !== "pagado")
    .reduce((sum, f) => sum + (f.cobro.monto ?? 0), 0);
  const totalVencido = filas
    .filter((f) => f.estado === "vencido")
    .reduce((sum, f) => sum + (f.cobro.monto ?? 0), 0);
  const totalCobrado = filas
    .filter((f) => f.estado === "pagado")
    .reduce((sum, f) => sum + (f.cobro.monto ?? 0), 0);

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-6 lg:max-w-[880px] lg:px-8 lg:pt-10">
      <header className="mb-5 lg:mb-8">
        <p className="text-[0.8125rem] font-medium capitalize text-texto-secundario">
          {format(new Date(), "MMMM yyyy", { locale: es })}
        </p>
        <h1 className="text-[1.25rem] font-semibold">Plata</h1>
      </header>

      {totalPendiente > 0 && (
        <div className="mb-5 flex flex-col gap-3 lg:mb-8 lg:flex-row">
          <StatCard label="Por cobrar este mes" valor={totalPendiente} />
          {totalVencido > 0 && <StatCard label="Vencido" valor={totalVencido} tono="terracota" />}
          {totalCobrado > 0 && <StatCard label="Cobrado" valor={totalCobrado} tono="verde" />}
        </div>
      )}

      {filas.length === 0 ? (
        <EmptyState title="Nada para cobrar todavía" detail="Los cobros del mes aparecen acá una vez que tengas clientes activos." />
      ) : (
        <ul className="flex flex-col divide-y divide-borde border-y border-borde lg:rounded-[12px] lg:border lg:border-borde lg:bg-bg-elevada lg:px-3">
          {filas.map(({ cobro, cliente, estado }) => (
            <li key={cobro.id} className="flex items-center gap-3 px-2 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{cliente!.nombre}</p>
                <p className="text-[0.8125rem] text-texto-secundario">
                  Vence {format(new Date(cobro.fechaVencimiento), "d MMM", { locale: es })}
                  {cobro.monto ? ` · $${cobro.monto.toLocaleString("es-AR")}` : ""}
                </p>
              </div>
              <button
                onClick={() =>
                  crearOActualizarCobro(cliente!.id, periodo, {
                    estado: estado === "pagado" ? "pendiente" : "pagado",
                    fechaPago: estado === "pagado" ? undefined : toISODate(new Date()),
                  })
                }
                className={cn(
                  "shrink-0 rounded-[8px] px-2.5 py-1 text-[0.8125rem] font-medium",
                  estado === "pagado" && "bg-verde/15 text-verde",
                  estado === "vencido" && "bg-terracota/15 text-terracota",
                  estado === "pendiente" && "bg-ambar/15 text-ambar",
                )}
              >
                {ESTADO_LABEL[estado]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  valor,
  tono = "neutral",
}: {
  label: string;
  valor: number;
  tono?: "neutral" | "terracota" | "verde";
}) {
  return (
    <div className="flex-1 rounded-[12px] border border-borde bg-bg-elevada px-4 py-3">
      <p className="text-[0.8125rem] text-texto-secundario">{label}</p>
      <p
        className={cn(
          "font-semibold",
          tono === "terracota" && "text-terracota",
          tono === "verde" && "text-verde",
        )}
      >
        ${valor.toLocaleString("es-AR")}
      </p>
    </div>
  );
}
