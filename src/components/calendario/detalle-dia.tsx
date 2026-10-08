"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PackageCheck, Video, Wallet } from "lucide-react";
import { DiaCalendario, colorCliente } from "@/lib/domain/calendario";
import { fromISODate } from "@/lib/domain/dates";
import { Client } from "@/lib/domain/types";

const fmt = (h: number) => `${Math.round(h * 100) / 100}`.replace(".", ",");

export function DetalleDia({ info, clients }: { info: DiaCalendario; clients: Client[] }) {
  const nombre = (id?: string) => clients.find((c) => c.id === id)?.nombre ?? "";
  const vacio = info.tareas.length === 0 && info.hitos.length === 0 && info.cobros.length === 0;

  return (
    <section key={info.fecha} className="papel entra mt-5 px-4 py-3.5">
      <header className="mb-2 flex items-baseline justify-between">
        <h2 className="titulo-serif text-[1.125rem] font-medium capitalize">{format(fromISODate(info.fecha), "EEEE d 'de' MMMM", { locale: es })}</h2>
        {info.carga && (
          <p className="text-[0.8125rem] text-texto-secundario">
            {fmt(info.carga.horas)} de {fmt(info.carga.capacidad)} h
          </p>
        )}
      </header>

      {vacio && <p className="text-[0.9375rem] text-texto-secundario">Nada planificado este día.</p>}

      <ul className="flex flex-col gap-2">
        {info.hitos.map((h, i) => (
          <li key={`h${i}`} className="flex items-center gap-2 text-[0.9375rem] font-medium">
            {h.tipo === "grabacion" ? <Video size={16} /> : <PackageCheck size={16} />}
            {h.detalle}
          </li>
        ))}
        {info.cobros.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[0.9375rem] font-medium">
            <Wallet size={16} />
            Cobro {nombre(c.clienteId)}
            {c.monto != null && <span className="font-normal text-texto-secundario">· ${c.monto.toLocaleString("es-AR")}</span>}
          </li>
        ))}
        {info.tareas.map((t) => (
          <li key={t.unidad.id} className="flex items-start gap-2 text-[0.9375rem]">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: colorCliente(clients, t.unidad.clienteId) }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{nombre(t.unidad.clienteId)}</span>
              <span className="text-texto-secundario"> · {t.unidad.etiqueta}</span>
            </span>
            <span className="shrink-0 text-[0.8125rem] text-texto-secundario">{fmt(t.unidad.horas)}h</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
