"use client";

import { isSameMonth } from "date-fns";
import { PackageCheck, Video, Wallet } from "lucide-react";
import { DiaCalendario, colorCliente, grillaDelMes } from "@/lib/domain/calendario";
import { toISODate } from "@/lib/domain/dates";
import { Client } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const DIAS_CORTOS = ["L", "M", "M", "J", "V", "S", "D"];

export function VistaMes({
  ancla,
  dias,
  clients,
  seleccionado,
  onSeleccionar,
  hoyISO,
}: {
  ancla: Date;
  dias: Record<string, DiaCalendario>;
  clients: Client[];
  seleccionado: string | null;
  onSeleccionar: (fecha: string) => void;
  hoyISO: string;
}) {
  const grilla = grillaDelMes(ancla);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[0.8125rem] font-medium text-texto-secundario">
        {DIAS_CORTOS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grilla.map((d) => {
          const iso = toISODate(d);
          const info = dias[iso];
          const fuera = !isSameMonth(d, ancla);
          const sobrecargado = info?.carga?.semaforo === "sobrecargado";
          const clientesDelDia = [...new Set((info?.tareas ?? []).map((t) => t.unidad.clienteId))].slice(0, 4);
          const hayGrab = info?.hitos.some((h) => h.tipo === "grabacion");
          const hayEntrega = info?.hitos.some((h) => h.tipo === "entrega");
          const hayCobro = (info?.cobros.length ?? 0) > 0;
          return (
            <button
              key={iso}
              onClick={() => onSeleccionar(iso)}
              aria-label={`${iso}${sobrecargado ? ", día sobrecargado" : ""}`}
              aria-pressed={seleccionado === iso}
              className={cn(
                "flex min-h-[64px] flex-col items-center gap-1 rounded-[8px] border px-1 py-1.5 lg:min-h-[88px]",
                seleccionado === iso ? "border-terracota" : "border-transparent",
                sobrecargado ? "bg-terracota/15" : "bg-bg-elevada",
                fuera && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "text-[0.8125rem] font-medium",
                  iso === hoyISO ? "rounded-full bg-terracota px-1.5 text-bg" : "text-texto",
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex h-4 items-center gap-0.5 text-texto-secundario">
                {hayGrab && <Video size={12} aria-label="Grabación" />}
                {hayEntrega && <PackageCheck size={12} aria-label="Entrega" />}
                {hayCobro && <Wallet size={12} aria-label="Cobro" />}
              </span>
              <span className="flex gap-0.5">
                {clientesDelDia.map((id) => (
                  <span
                    key={id ?? "x"}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: colorCliente(clients, id) }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-texto-secundario">
        <span className="flex items-center gap-1">
          <Video size={12} /> Grabación
        </span>
        <span className="flex items-center gap-1">
          <PackageCheck size={12} /> Entrega
        </span>
        <span className="flex items-center gap-1">
          <Wallet size={12} /> Cobro
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-[4px] bg-terracota/15" /> Día sobrecargado
        </span>
      </p>
    </div>
  );
}
