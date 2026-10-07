"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PackageCheck, Video } from "lucide-react";
import { DiaCalendario, colorCliente, diasDeLaSemana } from "@/lib/domain/calendario";
import { toISODate } from "@/lib/domain/dates";
import { Client } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const SEMAFORO: Record<string, string> = {
  libre: "bg-verde",
  justo: "bg-ambar",
  sobrecargado: "bg-terracota",
  "sin-capacidad": "bg-borde",
};

const fmt = (h: number) => `${Math.round(h * 100) / 100}`.replace(".", ",");

export function VistaSemana({
  ancla,
  dias,
  clients,
  hoyISO,
  onMover,
}: {
  ancla: Date;
  dias: Record<string, DiaCalendario>;
  clients: Client[];
  hoyISO: string;
  /** Called when a piece-based task is dropped on another day. */
  onMover: (piezaId: string, fecha: string) => void;
}) {
  const [sobre, setSobre] = useState<string | null>(null);
  const semana = diasDeLaSemana(ancla);

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="grid min-w-[1120px] grid-cols-7 gap-2 lg:min-w-0">
          {semana.map((d) => {
            const iso = toISODate(d);
            const info = dias[iso];
            const carga = info?.carga;
            return (
              <section
                key={iso}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(iso);
                }}
                onDragLeave={() => setSobre((s) => (s === iso ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const piezaId = e.dataTransfer.getData("text/pieza");
                  if (piezaId) onMover(piezaId, iso);
                }}
                aria-label={format(d, "EEEE d", { locale: es })}
                className={cn(
                  "flex min-h-[200px] flex-col rounded-[12px] border bg-bg-elevada p-2",
                  sobre === iso ? "border-terracota" : "border-borde",
                )}
              >
                <header className="mb-2 flex items-center justify-between">
                  <p className={cn("text-[0.8125rem] font-medium capitalize", iso === hoyISO && "text-terracota")}>
                    {format(d, "EEE d", { locale: es })}
                  </p>
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", SEMAFORO[carga?.semaforo ?? "sin-capacidad"])}
                    title={carga ? `${fmt(carga.horas)} de ${fmt(carga.capacidad)} h` : "Fuera del plan"}
                  />
                </header>
                <p className="mb-2 text-[0.8125rem] text-texto-secundario">
                  {carga ? `${fmt(carga.horas)} / ${fmt(carga.capacidad)} h` : "—"}
                </p>

                {info?.hitos.map((h, i) => (
                  <p key={i} className="mb-1.5 flex items-center gap-1.5 text-[0.8125rem] font-medium">
                    {h.tipo === "grabacion" ? <Video size={12} /> : <PackageCheck size={12} />}
                    <span className="truncate">{h.detalle}</span>
                  </p>
                ))}

                <ul className="flex flex-col gap-1.5">
                  {info?.tareas.map((t) => {
                    const arrastrable = !!t.unidad.piezaId;
                    return (
                      <li
                        key={t.unidad.id}
                        draggable={arrastrable}
                        onDragStart={(e) => {
                          if (t.unidad.piezaId) e.dataTransfer.setData("text/pieza", t.unidad.piezaId);
                        }}
                        className={cn(
                          "rounded-[8px] bg-bg px-2 py-1.5 text-[0.8125rem]",
                          arrastrable && "cursor-grab",
                          t.atrasada && "bg-terracota/10",
                        )}
                      >
                        <p className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: colorCliente(clients, t.unidad.clienteId) }}
                          />
                          <span className="truncate font-medium">
                            {clients.find((c) => c.id === t.unidad.clienteId)?.nombre ?? "Tarea"}
                          </span>
                          <span className="ml-auto shrink-0 text-texto-secundario">{fmt(t.unidad.horas)}h</span>
                        </p>
                        <p className="truncate text-texto-secundario">{t.unidad.etiqueta}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[0.8125rem] text-texto-secundario">
        Arrastrá una tarea a otro día para fijarle una fecha. La app siempre usa el primer día con lugar desde esa fecha.
      </p>
    </div>
  );
}
