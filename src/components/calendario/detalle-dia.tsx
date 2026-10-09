"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Star, Wallet } from "lucide-react";
import { DiaCalendario, colorCliente } from "@/lib/domain/calendario";
import { fromISODate } from "@/lib/domain/dates";
import { FechaEspecial } from "@/lib/domain/fechas-especiales";
import { agruparPorCliente } from "@/lib/domain/hoy";
import { fmtPiezas } from "@/lib/domain/planner";
import { Client } from "@/lib/domain/types";
import { IconoHito } from "@/components/entrega";

export function DetalleDia({
  info,
  clients,
  especial,
}: {
  info: DiaCalendario;
  clients: Client[];
  especial?: FechaEspecial;
}) {
  const nombre = (id?: string) => clients.find((c) => c.id === id)?.nombre ?? "";
  const grupos = agruparPorCliente(info.tareas, clients);
  const vacio = info.tareas.length === 0 && info.hitos.length === 0 && info.cobros.length === 0 && !especial;

  return (
    <section key={info.fecha} className="papel entra mt-5 px-4 py-3.5">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="titulo-serif text-[1.125rem] font-medium capitalize">
          {format(fromISODate(info.fecha), "EEEE d 'de' MMMM", { locale: es })}
        </h2>
        {info.carga && info.carga.capacidad > 0 && (
          <p className="text-[0.8125rem] text-texto-secundario">
            {fmtPiezas(info.carga.carga)} de {fmtPiezas(info.carga.capacidad)} piezas
          </p>
        )}
      </header>

      {vacio && <p className="text-[0.9375rem] text-texto-secundario">Nada planificado este día.</p>}

      <ul className="flex flex-col gap-2">
        {especial && (
          <li className="flex items-center gap-2 text-[0.9375rem] font-medium">
            <Star size={16} className="fill-ambar text-ambar" />
            {especial.nombre}
            {especial.clienteIds.length > 0 && (
              <span className="font-normal text-texto-secundario">· {especial.clienteIds.map(nombre).join(", ")}</span>
            )}
          </li>
        )}
        {info.hitos.map((h, i) => (
          <li
            key={`h${i}`}
            className="flex items-center gap-2 text-[0.9375rem] font-medium"
            style={{ color: colorCliente(clients, h.clienteId) }}
          >
            <IconoHito tipo={h.tipo} size={16} />
            <span className="text-texto">{h.detalle}</span>
          </li>
        ))}
        {info.cobros.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[0.9375rem] font-medium">
            <Wallet size={16} />
            Cobro {nombre(c.clienteId)}
            {c.monto != null && <span className="font-normal text-texto-secundario">· ${c.monto.toLocaleString("es-AR")}</span>}
          </li>
        ))}
        {grupos.map((g) => (
          <li key={g.clienteId ?? "otras"} className="flex items-start gap-2 text-[0.9375rem]">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: colorCliente(clients, g.clienteId) }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{g.nombre}:</span>
              <span className="text-texto-secundario"> {g.resumen}</span>
              {g.asignaciones.some((a) => a.unidad.provisoria) && (
                <span className="text-texto-secundario"> (provisorio)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
