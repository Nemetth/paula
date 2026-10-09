"use client";

import { isSameMonth } from "date-fns";
import { PackageCheck, Presentation, Star, Video, Wallet } from "lucide-react";
import { DiaCalendario, colorCliente, grillaDelMes } from "@/lib/domain/calendario";
import { toISODate } from "@/lib/domain/dates";
import { FechaEspecial } from "@/lib/domain/fechas-especiales";
import { Hito } from "@/lib/domain/planner";
import { Client } from "@/lib/domain/types";
import { IconoHito, nombreCorto } from "@/components/entrega";
import { cn } from "@/lib/utils";

const DIAS_CORTOS = ["L", "M", "M", "J", "V", "S", "D"];
const ORDEN_HITO: Record<Hito["tipo"], number> = { entrega: 0, grabacion: 1, presentacion: 2 };
const MAX_CHIPS = 3;

export function VistaMes({
  ancla,
  dias,
  clients,
  especiales,
  seleccionado,
  onSeleccionar,
  hoyISO,
}: {
  ancla: Date;
  dias: Record<string, DiaCalendario>;
  clients: Client[];
  especiales: FechaEspecial[];
  seleccionado: string | null;
  onSeleccionar: (fecha: string) => void;
  hoyISO: string;
}) {
  const grilla = grillaDelMes(ancla);
  const nombre = (id: string) => nombreCorto(clients.find((c) => c.id === id)?.nombre ?? "");
  const especialDe = new Map(especiales.map((e) => [e.fecha, e]));

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[0.8125rem] font-medium text-texto-secundario">
        {DIAS_CORTOS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div key={toISODate(ancla).slice(0, 7)} className="aparece grid grid-cols-7 gap-1">
        {grilla.map((d) => {
          const iso = toISODate(d);
          const info = dias[iso];
          const fuera = !isSameMonth(d, ancla);
          const sobrecargado = info?.carga?.semaforo === "sobrecargado";
          const clientesDelDia = [...new Set((info?.tareas ?? []).map((t) => t.unidad.clienteId))].slice(0, 4);
          const hitos = [...(info?.hitos ?? [])].sort((a, b) => ORDEN_HITO[a.tipo] - ORDEN_HITO[b.tipo]);
          const hayCobro = (info?.cobros.length ?? 0) > 0;
          const especial = especialDe.get(iso);
          return (
            <button
              key={iso}
              onClick={() => onSeleccionar(iso)}
              aria-label={`${iso}${sobrecargado ? ", día sobrecargado" : ""}${hitos.map((h) => `, ${h.detalle}`).join("")}`}
              aria-pressed={seleccionado === iso}
              className={cn(
                "tocable flex min-h-[76px] min-w-0 flex-col items-stretch gap-0.5 rounded-[12px] border px-0.5 py-1 lg:min-h-[108px] lg:px-1",
                seleccionado === iso
                  ? "border-terracota/70 bg-bg-elevada shadow-papel-alto"
                  : "border-transparent hover:border-borde",
                seleccionado !== iso && (sobrecargado ? "bg-terracota/15" : "bg-bg-elevada/70 hover:bg-bg-elevada"),
                fuera && "opacity-40",
              )}
            >
              <span className="flex items-center justify-center gap-0.5">
                <span
                  className={cn(
                    "numeros flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[0.8125rem] font-medium",
                    iso === hoyISO ? "bg-terracota text-bg shadow-boton" : "text-texto",
                  )}
                >
                  {d.getDate()}
                </span>
                {especial && <Star size={10} className="shrink-0 fill-ambar text-ambar" aria-label={especial.nombre} />}
                {hayCobro && <Wallet size={10} className="shrink-0 text-texto-secundario" aria-label="Cobro" />}
              </span>
              {hitos.slice(0, MAX_CHIPS).map((h, i) => {
                const color = colorCliente(clients, h.clienteId);
                return (
                  <span
                    key={`${h.tipo}-${h.clienteId}-${i}`}
                    className={cn(
                      "flex min-w-0 items-center gap-0.5 rounded-[5px] px-1 text-left text-[0.625rem] font-semibold leading-[1.5] lg:text-[0.6875rem]",
                      h.tipo === "presentacion" && "border border-dashed",
                    )}
                    style={{
                      background:
                        h.tipo === "presentacion" ? "transparent" : `color-mix(in oklab, ${color} 18%, transparent)`,
                      borderColor: color,
                      color,
                    }}
                  >
                    <span className="shrink-0">
                      <IconoHito tipo={h.tipo} size={9} />
                    </span>
                    <span className="truncate">{nombre(h.clienteId)}</span>
                  </span>
                );
              })}
              {hitos.length > MAX_CHIPS && (
                <span className="text-center text-[0.625rem] text-texto-secundario">+{hitos.length - MAX_CHIPS}</span>
              )}
              <span className="mt-auto flex justify-center gap-0.5 pt-0.5">
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
          <PackageCheck size={12} /> Entrega
        </span>
        <span className="flex items-center gap-1">
          <Video size={12} /> Grabación
        </span>
        <span className="flex items-center gap-1">
          <Presentation size={12} /> Presentación (entrega menos margen)
        </span>
        <span className="flex items-center gap-1">
          <Wallet size={12} /> Cobro
        </span>
        <span className="flex items-center gap-1">
          <Star size={12} className="fill-ambar text-ambar" /> Fecha especial
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-texto-secundario" /> Clientes con trabajo ese día
        </span>
      </p>
    </div>
  );
}
